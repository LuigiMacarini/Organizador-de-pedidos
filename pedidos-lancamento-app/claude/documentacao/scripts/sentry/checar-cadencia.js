// Confere a cadência do coletor: intervalo entre amostras da execução (run_id) mais recente do Android.
const fs = require("fs");
const TOKEN_FILE = "C:\\dev\\sentry-token.txt";
const API = "https://us.sentry.io/api/0/organizations/org-sentry/events/";
const token = fs.readFileSync(TOKEN_FILE, "utf8").trim();
const hora = (t) => new Date((t - 3 * 3600) * 1000).toISOString().slice(11, 19);

(async () => {
  for (const m of ["perf.cpu", "perf.memory.pss", "perf.fps.ui"]) {
    const p = new URLSearchParams();
    p.append("dataset", "tracemetrics");
    for (const f of ["value", "timestamp_precise", "run_id"]) p.append("field", f);
    p.append("query", `metric.name:${m} platform:android`);
    p.append("statsPeriod", "15m");
    p.append("sort", "timestamp_precise");
    p.append("per_page", "100");
    const res = await fetch(`${API}?${p}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = (await res.json()).data || [];
    if (!d.length) { console.log(`${m}: nenhuma amostra ainda`); continue; }
    const run = d[d.length - 1].run_id;
    const s = d.filter((x) => x.run_id === run).map((x) => ({ t: x.timestamp_precise / 1e9, v: x.value }));
    const gaps = s.slice(1).map((x, i) => (x.t - s[i].t).toFixed(1));
    const dec = m.includes("memory") ? 0 : 1;
    const vals = s.map((x) => (m.includes("memory") ? (x.v / 1e6).toFixed(1) + "MB" : x.v.toFixed(dec)));
    console.log(`${m.padEnd(16)} run=${run} | amostras=${s.length} | primeira=${hora(s[0].t)}`);
    console.log(`  intervalos (s): ${gaps.join(", ")}`);
    console.log(`  valores: ${vals.join(", ")}`);
  }
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
