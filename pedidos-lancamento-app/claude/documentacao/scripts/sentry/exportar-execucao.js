// Exporta as métricas perf.* de uma execução (run_id) do Sentry para JSON (dados brutos, sem tratamento).
// Uso: node exportar-execucao.js <run_id> <período, ex.: 24h ou 7d> <saida.json> [início] [fim]
// Início e fim (opcionais) recortam a sessão pelo horário, no formato 2026-10-13T20:46:00-03:00.
// O recorte importa porque o run_id marca o processo do app, não a sessão (doc, seção 4.9).
const fs = require("fs");
const token = fs.readFileSync("C:/dev/sentry-token.txt", "utf8").trim();
const API = "https://us.sentry.io/api/0/organizations/org-sentry/events/";
const [runId, periodo = "24h", saida, inicio, fim] = process.argv.slice(2);
if (!runId || !saida) {
  console.error("Uso: node exportar-execucao.js <run_id> <período> <saida.json> [início] [fim]");
  process.exit(1);
}
const lerHora = (texto) => {
  const ms = Date.parse(texto);
  if (Number.isNaN(ms)) throw new Error(`horário inválido: ${texto} (use 2026-10-13T20:46:00-03:00)`);
  return ms / 1000;
};
const tInicio = inicio ? lerHora(inicio) : -Infinity;
const tFim = fim ? lerHora(fim) : Infinity;
const METRICAS = ["perf.cpu", "perf.fps.ui", "perf.frame.max_interval", "perf.memory.pss", "perf.memory.rss",
  "perf.memory.java_heap", "perf.memory.native_heap", "perf.memory.graphics", "perf.memory.footprint",
  "perf.memory.footprint_peak", "perf.sampler.memory_read"];
// Atributos numéricos e booleanos só voltam com a sintaxe tipada tags[nome,tipo].
const CAMPOS = ["value", "timestamp_precise", "run_id", "route", "platform", "device_model", "tags[cpu_cores,number]",
  "tags[refresh_rate_hz,number]", "thermal_state", "tags[power_save,boolean]"];
async function buscar(metrica) {
  const p = new URLSearchParams({ dataset: "tracemetrics", query: `metric.name:${metrica} run_id:${runId}`,
    statsPeriod: periodo, sort: "timestamp_precise", per_page: "100" });
  for (const f of CAMPOS) p.append("field", f);
  let url = `${API}?${p}`, linhas = [];
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`${metrica}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    linhas.push(...((await res.json()).data || []).map((r) => ({ metrica, ...r, cpu_cores: r["tags[cpu_cores,number]"], refresh_rate_hz: r["tags[refresh_rate_hz,number]"], power_save: r["tags[power_save,boolean]"] })));
    const next = (res.headers.get("link") || "").split(",").find((l) => l.includes('rel="next"') && l.includes('results="true"'));
    url = next ? next.match(/<([^>]+)>/)[1] : null;
  }
  return linhas.filter((r) => r.timestamp_precise / 1e9 >= tInicio && r.timestamp_precise / 1e9 <= tFim);
}
(async () => {
  const todas = [];
  for (const m of METRICAS) { const l = await buscar(m); todas.push(...l); console.log(`${m.padEnd(26)} ${l.length}`); }
  const recorte = inicio || fim ? { inicio: inicio ?? null, fim: fim ?? null } : null;
  fs.writeFileSync(saida, JSON.stringify({ runId, recorte, exportadoEm: new Date().toISOString(), linhas: todas }, null, 1));
  console.log(`total: ${todas.length} linhas${recorte ? ` (recorte ${inicio ?? "…"} a ${fim ?? "…"})` : ""} -> ${saida}`);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
