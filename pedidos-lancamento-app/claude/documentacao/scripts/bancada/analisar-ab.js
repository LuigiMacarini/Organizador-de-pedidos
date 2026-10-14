// Teste A/B de sobrecarga: build A (sem Sentry e sem coletor) x build B (experimento),
// medidas de fora do app via adb. Sobrecarga = B - A.
const fs = require("fs");
const path = require("path");

const DIR = process.argv[2] || path.join(__dirname, "..", "..", "dados", "teste-sobrecarga-ab-brutos");
const CLK_TCK = 100;
const read = (f) => fs.readFileSync(path.join(DIR, f), "utf8").replace(/^﻿/, "");
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : 0; };
const fmt = (x, d = 1) => x.toFixed(d).replace(".", ",");

const rounds = fs.readdirSync(DIR).filter((f) => /^r\d+_[AB]_cpu\.txt$/.test(f))
  .map((f) => { const [, n, b] = f.match(/^r(\d+)_([AB])_/); return { n: Number(n), b }; })
  .sort((x, y) => x.n - y.n);

const results = [];
for (const { n, b } of rounds) {
  const lines = read(`r${n}_${b}_cpu.txt`).split(/\r?\n/);
  const samples = [];
  const rss = [];
  let t = null;
  for (const line of lines) {
    const mt = line.match(/^T (\d+(?:\.\d+)?)/);
    if (mt) { t = Number(mt[1]); continue; }
    const mr = line.match(/^VmRSS:\s+(\d+)\s+kB/);
    if (mr) { rss.push(Number(mr[1]) * 1024 / 1e6); continue; }
    if (t !== null && line.includes(") ")) {
      const rest = line.slice(line.lastIndexOf(")") + 2).trim().split(/\s+/);
      samples.push({ t, ticks: Number(rest[11]) + Number(rest[12]) });
      t = null;
    }
  }
  const first = samples[0], last = samples[samples.length - 1];
  const cpu = ((last.ticks - first.ticks) / CLK_TCK / (last.t - first.t)) * 100;
  const perSecond = [];
  for (let i = 1; i < samples.length; i++) {
    perSecond.push(((samples[i].ticks - samples[i - 1].ticks) / CLK_TCK / (samples[i].t - samples[i - 1].t)) * 100);
  }
  const mem = read(`r${n}_${b}_meminfo.txt`);
  const pssM = mem.match(/TOTAL PSS:\s+(\d+)/);
  const info = read(`r${n}_${b}_info.txt`);
  results.push({
    n, b, cpu, cpuMax: Math.max(...perSecond), rss: mean(rss),
    pss: pssM ? Number(pssM[1]) * 1024 / 1e6 : NaN,
    dur: last.t - first.t,
    foco: /pedidoslancamento/.test(info.match(/foco=\[(.*?)\]/)?.[1] ?? ""),
    termico: info.match(/termico=\[(.*?)\]/)?.[1] ?? "",
    bateria: info.match(/bateria=\[(.*?)\]/)?.[1] ?? "",
  });
}

console.log("Rodada | Build | CPU média | CPU máx (1 s) | RSS médio | PSS final | duração | app em foco | térmico | bateria");
for (const r of results) {
  console.log(`${String(r.n).padStart(6)} | ${r.b.padStart(5)} | ${fmt(r.cpu, 2).padStart(8)}% | ${fmt(r.cpuMax).padStart(12)}% | ${fmt(r.rss).padStart(7)} MB | ${fmt(r.pss).padStart(7)} MB | ${fmt(r.dur, 0)} s | ${r.foco ? "sim" : "NÃO"} | ${r.termico} | ${r.bateria}`);
}

const by = (b, k) => results.filter((r) => r.b === b).map((r) => r[k]);
console.log("\nMédia ± desvio padrão (entre rodadas):");
for (const [k, label, unit, d] of [["cpu", "CPU média", "%", 2], ["rss", "RSS", "MB", 1], ["pss", "PSS", "MB", 1]]) {
  const a = by("A", k), bb = by("B", k);
  console.log(`  ${label.padEnd(9)} A=${fmt(mean(a), d)} ± ${fmt(sd(a), d)} ${unit} | B=${fmt(mean(bb), d)} ± ${fmt(sd(bb), d)} ${unit} | sobrecarga (B−A)=${fmt(mean(bb) - mean(a), d)} ${unit === "%" ? "p.p." : unit} (${fmt(((mean(bb) - mean(a)) / mean(a)) * 100, 1)}%)`);
}
