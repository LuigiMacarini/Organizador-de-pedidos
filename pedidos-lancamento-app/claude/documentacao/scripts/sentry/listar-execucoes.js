// Lista as execuções (run_id) recentes do coletor: início, fim, nº de amostras de CPU e telas visitadas.
const fs = require("fs");
const token = fs.readFileSync("C:/dev/sentry-token.txt", "utf8").trim();
const API = "https://us.sentry.io/api/0/organizations/org-sentry/events/";
const periodo = process.argv[2] || "90m";
const hora = (ns) => new Date(ns / 1e6 - 3 * 3600e3).toISOString().slice(11, 19);
(async () => {
  const p = new URLSearchParams({ dataset: "tracemetrics", query: "metric.name:perf.cpu", statsPeriod: periodo, sort: "timestamp_precise", per_page: "100" });
  for (const f of ["value", "timestamp_precise", "run_id", "route", "platform"]) p.append("field", f);
  let url = `${API}?${p}`, rows = [];
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    rows.push(...((await res.json()).data || []));
    const next = (res.headers.get("link") || "").split(",").find((l) => l.includes('rel="next"') && l.includes('results="true"'));
    url = next ? next.match(/<([^>]+)>/)[1] : null;
  }
  const runs = new Map();
  for (const r of rows) {
    const x = runs.get(r.run_id) || { n: 0, ini: Infinity, fim: 0, rotas: new Set(), plat: r.platform };
    x.n++; x.ini = Math.min(x.ini, r.timestamp_precise); x.fim = Math.max(x.fim, r.timestamp_precise); x.rotas.add(r.route);
    runs.set(r.run_id, x);
  }
  for (const [id, x] of [...runs].sort((a, b) => a[1].ini - b[1].ini))
    console.log(`${id} | ${x.plat} | ${hora(x.ini)}–${hora(x.fim)} | amostras de CPU: ${x.n} | telas: ${[...x.rotas].join(", ")}`);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
