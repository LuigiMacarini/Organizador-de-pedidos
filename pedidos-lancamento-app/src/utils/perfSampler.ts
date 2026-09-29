import * as Sentry from "@sentry/react-native";
import { AppState, type AppStateStatus, Platform } from "react-native";
import PerfSampler, { type PerfSample } from "../../modules/perf-sampler";

/**
 * Coletor de CPU, memória e FPS do experimento do TCC. Lê o sensor nativo
 * (`modules/perf-sampler`) a cada 15 s e envia cada amostra como métrica ao
 * Sentry. As fórmulas ficam só aqui, iguais para Android e iOS. Métricas,
 * atributos e decisões em claude/documentacao/metricas-desempenho-tcc.md.
 */

/**
 * Coleta a cada 15 s, como no protocolo do artigo (Käld e Svensson, 2021).
 * CPU e FPS vêm de contadores acumulados, então cada valor é a média exata dos
 * 15 s; o maior intervalo entre quadros guarda o pior pico dentro da janela.
 */
const SAMPLE_INTERVAL_MS = 15_000;

/** Cada lançamento do app é uma repetição do protocolo e ganha um id próprio. */
const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let route = "startup";
let timer: ReturnType<typeof setInterval> | null = null;
let previous: PerfSample | null = null;
let reading = false;
let started = false;
/** Muda a cada pausa/retomada para descartar uma leitura que termine depois disso. */
let generation = 0;

/** Chamado a cada troca de tela; a rota vira atributo das métricas. */
export function setPerfRoute(nextRoute: string): void {
  route = nextRoute;
}

export function startPerfSampler(): void {
  if (!PerfSampler || started) return;
  started = true;
  AppState.addEventListener("change", handleAppStateChange);
  if (AppState.currentState === "active") resume();
}

// Só mede com o app em primeiro plano: em segundo plano não há quadros e a
// coleta só gastaria bateria.
function handleAppStateChange(state: AppStateStatus) {
  if (state === "active") resume();
  else pause();
}

function resume() {
  if (!PerfSampler || timer) return;
  generation++;
  previous = null;
  PerfSampler.startFrameCounter().catch(() => undefined);
  // Leitura imediata como ponto de partida: a primeira janela de 15 s já conta.
  void takeSample();
  timer = setInterval(takeSample, SAMPLE_INTERVAL_MS);
}

function pause() {
  if (!PerfSampler || !timer) return;
  generation++;
  clearInterval(timer);
  timer = null;
  previous = null;
  PerfSampler.stopFrameCounter().catch(() => undefined);
  // As métricas ficam em buffer; enviar ao sair do app evita perder o fim da repetição.
  void Sentry.flush();
}

async function takeSample() {
  if (!PerfSampler || reading) return;
  reading = true;
  const currentGeneration = generation;
  try {
    const sample = await PerfSampler.readSample(true);
    if (currentGeneration === generation) record(sample);
  } catch {
    // Uma leitura com erro só perde aquela amostra.
  } finally {
    reading = false;
  }
}

function record(sample: PerfSample) {
  const attributes = buildAttributes(sample);

  // A primeira leitura depois de iniciar/retomar só serve de ponto de partida.
  if (previous) {
    const elapsedMs = sample.monotonicMs - previous.monotonicMs;
    if (elapsedMs > 0) {
      if (sample.cpuTimeMs != null && previous.cpuTimeMs != null) {
        // Tempo de CPU do processo dividido pelo tempo real: 100% = um núcleo inteiro ocupado.
        const cpuPercent = ((sample.cpuTimeMs - previous.cpuTimeMs) / elapsedMs) * 100;
        Sentry.metrics.distribution("perf.cpu", cpuPercent, { unit: "percent", attributes });
      }
      // Callbacks de quadro da thread principal por segundo real.
      const fps = sample.frameCount / (elapsedMs / 1000);
      Sentry.metrics.distribution("perf.fps.ui", fps, { attributes });
      Sentry.metrics.distribution("perf.frame.max_interval", sample.maxFrameIntervalMs, {
        unit: "millisecond",
        attributes,
      });
    }
  }

  if (sample.memory) {
    for (const [name, bytes] of Object.entries(sample.memory)) {
      if (bytes != null) {
        Sentry.metrics.distribution(`perf.memory.${name}`, bytes, { unit: "byte", attributes });
      }
    }
  }
  if (sample.memoryReadMs != null) {
    Sentry.metrics.distribution("perf.sampler.memory_read", sample.memoryReadMs, {
      unit: "millisecond",
      attributes,
    });
  }

  previous = sample;
}

function buildAttributes(sample: PerfSample): Record<string, string | number | boolean> {
  const attributes: Record<string, string | number | boolean> = {
    run_id: runId,
    route,
    platform: Platform.OS,
    device_model: PerfSampler?.deviceModel ?? "unknown",
    cpu_cores: PerfSampler?.cpuCores ?? 0,
  };
  if (sample.refreshRateHz != null) attributes.refresh_rate_hz = Math.round(sample.refreshRateHz);
  if (sample.thermalState != null) attributes.thermal_state = sample.thermalState;
  if (sample.powerSave != null) attributes.power_save = sample.powerSave;
  return attributes;
}
