// Compara o instrumento (métricas perf.* no Sentry) com as referências do Android
// capturadas por adb: /proc/<pid>/stat (CPU, mesma fonte do top) e dumpsys meminfo.
const fs = require("fs");
const path = require("path");

const DIR = process.argv[2] || "C:/dev/tcc-ferramentas/validacao";
const TOKEN_FILE = "C:\\dev\\sentry-token.txt";
const API = "https://us.sentry.io/api/0/organizations/org-sentry/events/";

const read = (f) => fs.readFileSync(path.join(DIR, f), "utf8").replace(/^\uFEFF/, "");
const info = Object.fromEntries(
  read("info.txt").split(/\r?\n/).filter(Boolean).map((l) => l.split("=")).map(([k, v]) => [k, v])
);
const CLK_TCK = Number(info.CLK_TCK);

// ---- CPU de referência: /proc/<pid>/stat a cada ~1 s ----
const cpuRef = [];
{
  const lines = read("cpu_procstat.txt").split(/\r?\n/);
  let t = null;
  const samples = [];
  for (const line of lines) {
    const m = line.match(/^T (\d+(?:\.\d+)?)/);
    if (m) { t = Number(m[1]); continue; }
    if (t !== null && line.includes(") ")) {
      const rest = line.slice(line.lastIndexOf(")") + 2).trim().split(/\s+/);
      // rest[0] = campo 3 (state); utime = campo 14, stime = campo 15
      const ticks = Number(rest[11]) + Number(rest[12]);
      samples.push({ t, ticks });
      t = null;
    }
  }
  for (let i = 1; i < samples.length; i++) {
    const dt = samples[i].t - samples[i - 1].t;
    const pct = ((samples[i].ticks - samples[i - 1].ticks) / CLK_TCK / dt) * 100;
    cpuRef.push({ tStart: samples[i - 1].t, tEnd: samples[i].t, pct });
  }
}

// ---- Memória de referência: dumpsys meminfo ----
const memRef = [];
{
  const blocks = read("meminfo.txt").split(/^T /m).filter((b) => b.trim());
  for (const b of blocks) {
    const t = Number(b.split(/\s/)[0]);
    const num = (re) => { const m = b.match(re); return m ? Number(m[1]) * 1024 : null; };
    memRef.push({
      t,
      pss: num(/TOTAL PSS:\s+(\d+)/),
      rss: num(/TOTAL RSS:\s+(\d+)/),
      java_heap: num(/^\s*Java Heap:\s+(\d+)/m),
      native_heap: num(/^\s*Native Heap:\s+(\d+)/m),
      graphics: num(/^\s*Graphics:\s+(\d+)/m),
    });
  }
}

const tStart = cpuRef[0].tStart - 5;
const tEnd = Math.max(cpuRef[cpuRef.length - 1].tEnd, memRef[memRef.length - 1].t) + 10;

async function fetchMetric(name) {
  const token = fs.readFileSync(TOKEN_FILE, "utf8").trim();
  const params = new URLSearchParams();
  params.append("dataset", "tracemetrics");
  for (const f of ["metric.name", "value", "timestamp_precise", "platform", "run_id", "route"]) params.append("field", f);
  params.append("query", `metric.name:${name} platform:android`);
  params.append("start", new Date(tStart * 1000).toISOString());
  params.append("end", new Date(tEnd * 1000).toISOString());
  params.append("sort", "timestamp_precise");
  params.append("per_page", "100");
  const res = await fetch(`${API}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json.data.map((d) => ({ t: d.timestamp_precise / 1e9, v: d.value, run: d.run_id, route: d.route }));
}

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const fmt = (x, d = 1) => x.toFixed(d).replace(".", ",");

(async () => {
  // CPU: agrega os dois lados em janelas de 5 s (reduz o efeito da defasagem de fase entre as amostragens).
  const cpuInst = await fetchMetric("perf.cpu");
  const cpuT0 = cpuRef[0].tStart;
  const cpuT1 = cpuRef[cpuRef.length - 1].tEnd;
  const inst = cpuInst.filter((s) => s.t > cpuT0 && s.t <= cpuT1);
  const runs = [...new Set(inst.map((s) => s.run))];
  console.log(`Janela de CPU: ${fmt(cpuT1 - cpuT0, 0)} s | amostras referência=${cpuRef.length} instrumento=${inst.length} | run_id=${runs.join(",")}`);

  const WIN = 5;
  const rows = [];
  for (let w = cpuT0; w + WIN <= cpuT1 + 0.01; w += WIN) {
    const ref = cpuRef.filter((s) => s.tEnd > w && s.tEnd <= w + WIN).map((s) => s.pct);
    const ins = inst.filter((s) => s.t > w && s.t <= w + WIN).map((s) => s.v);
    if (ref.length && ins.length) rows.push({ w: w - cpuT0, ref: mean(ref), ins: mean(ins) });
  }
  console.log("\nCPU (% de um núcleo), médias em janelas de 5 s:");
  console.log("  seg   | /proc/stat | instrumento | diferença");
  for (const r of rows) console.log(`  ${String(Math.round(r.w)).padStart(3)}–${String(Math.round(r.w + WIN)).padEnd(3)} | ${fmt(r.ref).padStart(10)} | ${fmt(r.ins).padStart(11)} | ${fmt(r.ins - r.ref).padStart(8)}`);

  const half = (cpuT1 - cpuT0) / 2;
  for (const [label, from, to] of [["parado (1ª metade)", 0, half], ["rolando (2ª metade)", half, cpuT1 - cpuT0], ["total", 0, cpuT1 - cpuT0]]) {
    const ref = cpuRef.filter((s) => s.tEnd - cpuT0 > from && s.tEnd - cpuT0 <= to).map((s) => s.pct);
    const ins = inst.filter((s) => s.t - cpuT0 > from && s.t - cpuT0 <= to).map((s) => s.v);
    console.log(`  ${label.padEnd(20)} média ref=${fmt(mean(ref))} inst=${fmt(mean(ins))} | mediana ref=${fmt(median(ref))} inst=${fmt(median(ins))} | máx ref=${fmt(Math.max(...ref))} inst=${fmt(Math.max(...ins))}`);
  }
  const mad = mean(rows.map((r) => Math.abs(r.ins - r.ref)));
  const mr = mean(rows.map((r) => r.ref)), mi = mean(rows.map((r) => r.ins));
  const cov = mean(rows.map((r) => (r.ref - mr) * (r.ins - mi)));
  const sd = (k, m) => Math.sqrt(mean(rows.map((r) => (r[k] - m) ** 2)));
  console.log(`  diferença absoluta média (janelas 5 s) = ${fmt(mad, 2)} p.p. | correlação = ${fmt(cov / (sd("ref", mr) * sd("ins", mi)), 3)}`);

  // Memória: cada leitura do dumpsys contra a amostra perf.memory.* mais próxima no tempo.
  console.log("\nMemória (MB): dumpsys meminfo × instrumento (amostra mais próxima):");
  const names = ["pss", "rss", "java_heap", "native_heap", "graphics"];
  const instMem = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await fetchMetric(`perf.memory.${n}`)])));
  for (const n of names) {
    const diffs = [];
    for (const r of memRef) {
      if (r[n] == null || !instMem[n].length) continue;
      const near = instMem[n].reduce((a, b) => (Math.abs(b.t - r.t) < Math.abs(a.t - r.t) ? b : a));
      if (Math.abs(near.t - r.t) > 6) continue;
      diffs.push({ ref: r[n] / 1e6, ins: near.v / 1e6, dt: near.t - r.t });
    }
    if (!diffs.length) { console.log(`  ${n}: sem pares`); continue; }
    const rel = mean(diffs.map((d) => Math.abs(d.ins - d.ref) / d.ref)) * 100;
    console.log(`  ${n.padEnd(12)} pares=${diffs.length} | ref média=${fmt(mean(diffs.map((d) => d.ref)))} | inst média=${fmt(mean(diffs.map((d) => d.ins)))} | diferença relativa média=${fmt(rel, 2)}%`);
  }
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
