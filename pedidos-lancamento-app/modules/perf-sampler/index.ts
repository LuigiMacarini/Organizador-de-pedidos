import { requireOptionalNativeModule } from "expo-modules-core";

/** Leitura crua do sensor nativo. As taxas (CPU %, FPS) são calculadas em `src/utils/perfSampler.ts`. */
export type PerfSample = {
  /** Relógio monotônico em ms; só a diferença entre duas leituras importa. */
  monotonicMs: number;
  /** Tempo de CPU acumulado do processo (CLOCK_PROCESS_CPUTIME_ID), em ms. */
  cpuTimeMs?: number;
  /** Callbacks de quadro da thread principal desde a leitura anterior. */
  frameCount: number;
  /** Maior intervalo entre dois quadros desde a leitura anterior, em ms. */
  maxFrameIntervalMs: number;
  refreshRateHz?: number | null;
  thermalState?: string | null;
  powerSave?: boolean | null;
  /** Bytes. Android: pss, java_heap, native_heap, graphics, rss. iOS: footprint, footprint_peak, rss. */
  memory?: Record<string, number | null>;
  /** Quanto a própria leitura de memória levou, em ms. */
  memoryReadMs?: number;
};

type PerfSamplerModule = {
  deviceModel: string;
  cpuCores: number;
  startFrameCounter(): Promise<void>;
  stopFrameCounter(): Promise<void>;
  readSample(includeMemory: boolean): Promise<PerfSample>;
};

/** `null` na web ou num binário sem o módulo; nesse caso o coletor não liga. */
export default requireOptionalNativeModule<PerfSamplerModule>("PerfSampler");
