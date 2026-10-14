// Gera a planilha de uma execução do coletor (dados brutos do Sentry + leituras + resumo por tela, com fórmulas)
// e confere as fórmulas recalculando com o HyperFormula e comparando com um cálculo independente em JS.
// Uso: node gerar-planilha-sessao.js <execucao.json> <saida.xlsx> "<descrição da execução>"
const fs = require("fs");
const path = require("path");
// exceljs@4 e hyperformula@2 ficam fora do app, em C:/dev/tcc-ferramentas (ver README: NODE_PATH).
const ExcelJS = require("exceljs");
const { HyperFormula } = require("hyperformula");

const [entrada, SAIDA, descricao = "Execução do coletor"] = process.argv.slice(2);
const exp = JSON.parse(fs.readFileSync(entrada, "utf8"));
const F = (f) => ({ f });
const hora = (s) => new Date((s - 3 * 3600) * 1000).toISOString().slice(11, 19);
const data = (s) => new Date((s - 3 * 3600) * 1000).toISOString().slice(0, 10).split("-").reverse().join("/");

// ---------- 1. Dados brutos, em ordem de tempo, com o número da leitura ----------
// Cada leitura do coletor envia várias métricas no mesmo instante (diferença de milissegundos).
const brutos = exp.linhas.map((r) => ({ ...r, t: r.timestamp_precise / 1e9 })).sort((a, b) => a.t - b.t);
let leitura = 0, t0 = null;
for (const r of brutos) {
  if (t0 === null || r.t - t0 >= 2) { leitura++; t0 = r.t; }
  r.leitura = leitura;
}
const nLeituras = leitura;
const unidade = (m) => (m === "perf.cpu" ? "% de um núcleo" : m === "perf.fps.ui" ? "quadros/s"
  : m.startsWith("perf.memory.") ? "byte" : "ms");
const inicio = brutos[0].t, fim = brutos[brutos.length - 1].t;

const sheets = {};
const B0 = 5, B1 = B0 + brutos.length - 1; // linhas de dados da aba "Dados brutos"
const rng = (col) => `'Dados brutos'!$${col}$${B0}:$${col}$${B1}`;

sheets["Dados brutos"] = [
  [`Dados brutos exportados do Sentry (dataset tracemetrics), execução ${exp.runId}, exportados em ${exp.exportadoEm.slice(0, 19).replace("T", " ")} UTC`],
  ["Uma linha por métrica recebida, sem tratamento. A coluna \"Leitura nº\" agrupa as métricas enviadas no mesmo instante (mesma leitura do coletor)."],
  [],
  ["Leitura nº", "Instante (s desde 1970, UTC)", "Métrica", "Valor", "Unidade", "Tela", "Estado térmico",
    "Economia de energia", "Taxa da tela (Hz)", "Aparelho", "Núcleos", "Plataforma", "run_id"],
  ...brutos.map((r) => [r.leitura, r.t, r.metrica, r.value, unidade(r.metrica), r.route, r.thermal_state,
    r.power_save == null ? null : r.power_save ? "sim" : "não", r.refresh_rate_hz ?? null, r.device_model,
    r.cpu_cores ?? null, r.platform, r.run_id]),
];

// ---------- 2. Leituras: uma linha por leitura, tudo por fórmula sobre os dados brutos ----------
const L0 = 5, L1 = L0 + nLeituras - 1;
const val = (metrica, row, divisor) => {
  const cond = `${rng("A")},$A${row},${rng("C")},"${metrica}"`;
  const soma = `SUMIFS(${rng("D")},${cond})`;
  return F(`IF(COUNTIFS(${cond})=0,"",${divisor ? `${soma}/${divisor}` : soma})`);
};
const primeiro = (col, row) => F(`INDEX(${rng(col)},MATCH($A${row},${rng("A")},0))`);
const leituras = [
  [`Leituras do coletor: ${descricao}`],
  ["CPU e FPS são médias exatas dos 15 s anteriores à leitura e ficam com o nome da tela aberta no momento da leitura. Leituras sem CPU/FPS são pontos de partida (abertura do app ou volta ao primeiro plano)."],
  [],
  ["Nº", "Hora (Brasília)", "Segundos desde o início", "Tela", "CPU (% de um núcleo)", "FPS (thread principal)",
    "Pior intervalo entre quadros (ms)", "PSS (MB)", "RSS (MB)", "Java heap (MB)", "Native heap (MB)",
    "Graphics (MB)", "Leitura de memória (ms)", "Estado térmico", "Economia de energia", "Taxa da tela (Hz)"],
];
for (let i = 1; i <= nLeituras; i++) {
  const row = L0 + i - 1;
  leituras.push([
    i,
    F(`_xlfn.MINIFS(${rng("B")},${rng("A")},$A${row})/86400+DATE(1970,1,1)-3/24`),
    F(`(B${row}-$B$${L0})*86400`),
    primeiro("F", row),
    val("perf.cpu", row), val("perf.fps.ui", row), val("perf.frame.max_interval", row),
    val("perf.memory.pss", row, 1e6), val("perf.memory.rss", row, 1e6), val("perf.memory.java_heap", row, 1e6),
    val("perf.memory.native_heap", row, 1e6), val("perf.memory.graphics", row, 1e6), val("perf.sampler.memory_read", row),
    primeiro("G", row), primeiro("H", row), primeiro("I", row),
  ]);
}
sheets["Leituras"] = leituras;

// ---------- 3. Resumo por tela ----------
const rotas = [...new Set(brutos.map((r) => r.route))];
const lr = (col) => `Leituras!$${col}$${L0}:$${col}$${L1}`;
const resumo = [
  [`Resumo por tela: ${descricao}`],
  [`${data(inicio)}, ${hora(inicio)} a ${hora(fim)} (horário de Brasília) · ${nLeituras} leituras a cada 15 s · execução ${exp.runId}`],
  ["Cada valor de CPU e FPS é a média dos 15 s anteriores à leitura e fica com a tela aberta no momento da leitura. Telas em que se ficou menos de 15 s podem não aparecer."],
  [],
  ["Tela", "Leituras com CPU", "CPU média (% de um núcleo)", "CPU máxima", "FPS médio", "FPS mínimo",
    "Pior intervalo entre quadros (ms)", "PSS médio (MB)", "PSS máximo (MB)"],
];
const R0 = 6;
rotas.forEach((rota, i) => {
  const r = R0 + i;
  resumo.push([
    rota,
    F(`COUNTIFS(${lr("D")},$A${r},${lr("E")},">=0")`),
    F(`IF($B${r}=0,"",AVERAGEIF(${lr("D")},$A${r},${lr("E")}))`),
    F(`IF($B${r}=0,"",_xlfn.MAXIFS(${lr("E")},${lr("D")},$A${r}))`),
    F(`IF($B${r}=0,"",AVERAGEIF(${lr("D")},$A${r},${lr("F")}))`),
    F(`IF($B${r}=0,"",_xlfn.MINIFS(${lr("F")},${lr("D")},$A${r}))`),
    F(`IF($B${r}=0,"",_xlfn.MAXIFS(${lr("G")},${lr("D")},$A${r}))`),
    F(`AVERAGEIF(${lr("D")},$A${r},${lr("H")})`),
    F(`_xlfn.MAXIFS(${lr("H")},${lr("D")},$A${r})`),
  ]);
});
const RT = R0 + rotas.length;
resumo.push([
  "Execução inteira", F(`COUNT(${lr("E")})`), F(`AVERAGE(${lr("E")})`), F(`MAX(${lr("E")})`), F(`AVERAGE(${lr("F")})`),
  F(`MIN(${lr("F")})`), F(`MAX(${lr("G")})`), F(`AVERAGE(${lr("H")})`), F(`MAX(${lr("H")})`),
]);
resumo.push([]);
resumo.push(["Como ler"]);
for (const t of [
  "CPU: % de um núcleo do processador; 100% = um núcleo inteiro ocupado (o aparelho tem 8). É a CPU do app, não do aparelho.",
  "FPS: pulsos de tela atendidos pela thread principal por segundo. Perto de 60 (tela a 60 Hz) = sem travadas.",
  "Pior intervalo entre quadros: ~17 ms = nenhum quadro perdido; ~33 ms = um quadro perdido; valores de centenas de ms = travada visível (ex.: abertura do app).",
  "PSS: memória do app contando a parte proporcional das bibliotecas compartilhadas (métrica oficial do Android). 1 MB = 1.000.000 bytes.",
  "Leitura de memória: tempo que o próprio coletor gasta lendo a memória a cada 15 s (custo do instrumento).",
]) resumo.push([t]);
sheets["Resumo por tela"] = resumo;

// ---------- 4. Verificação: HyperFormula + cálculo independente ----------
const order = ["Resumo por tela", "Leituras", "Dados brutos"];
const hf = HyperFormula.buildFromSheets(Object.fromEntries(order.map((n) => [n,
  sheets[n].map((row) => row.map((c) => (c && typeof c === "object" ? "=" + c.f.replace(/_xlfn\./g, "") : c ?? null)))])),
  { licenseKey: "gpl-v3" });
const v = (n, r, c) => hf.getCellValue({ sheet: hf.getSheetId(n), row: r, col: c });
let formulas = 0, erros = 0;
for (const n of order) sheets[n].forEach((row, r) => row.forEach((c, ci) => {
  if (c && typeof c === "object") {
    formulas++;
    const x = v(n, r, ci);
    if (x && typeof x === "object") { erros++; if (erros <= 5) console.log(`ERRO ${n}!R${r + 1}C${ci + 1}: ${x.type} ${x.message ?? ""}`); }
    c.result = x;
  }
}));
console.log(`fórmulas: ${formulas} | erros: ${erros}`);

// Cálculo independente por tela (sem planilha), para comparar com as fórmulas.
const porLeitura = new Map();
for (const r of brutos) {
  const x = porLeitura.get(r.leitura) || { rota: r.route, m: {} };
  x.m[r.metrica] = r.value; porLeitura.set(r.leitura, x);
}
const mean = (a) => a.reduce((s, y) => s + y, 0) / a.length;
let maior = 0;
rotas.forEach((rota, i) => {
  const ls = [...porLeitura.values()].filter((x) => x.rota === rota);
  const cpu = ls.map((x) => x.m["perf.cpu"]).filter((y) => y != null);
  const pss = ls.map((x) => x.m["perf.memory.pss"] / 1e6);
  const r = R0 - 1 + i;
  if (cpu.length) maior = Math.max(maior, Math.abs(v("Resumo por tela", r, 2) - mean(cpu)));
  maior = Math.max(maior, Math.abs(v("Resumo por tela", r, 7) - mean(pss)));
  if (v("Resumo por tela", r, 1) !== cpu.length) { erros++; console.log(`contagem diferente em ${rota}`); }
});
console.log(`maior diferença fórmula x cálculo independente: ${maior.toExponential(2)}`);
console.log("Resumo:");
for (let r = R0 - 1; r <= RT - 1; r++) {
  const g = (c) => v("Resumo por tela", r, c), f1 = (y) => (typeof y === "number" ? y.toFixed(1) : "-");
  console.log(`  ${String(g(0)).padEnd(16)} n=${String(g(1)).padStart(2)} | CPU ${f1(g(2)).padStart(5)} (máx ${f1(g(3)).padStart(5)}) | FPS ${f1(g(4))} (mín ${f1(g(5))}) | pior ${f1(g(6))} ms | PSS ${f1(g(7))} (máx ${f1(g(8))}) MB`);
}
if (erros) { console.log("HÁ ERROS: planilha não gravada"); process.exit(1); }

// ---------- 5. Escrita com ExcelJS ----------
const wb = new ExcelJS.Workbook();
wb.creator = "LuigiMacarini";
wb.created = new Date();
wb.calcProperties = { fullCalcOnLoad: true };
const fonte = { name: "Arial", size: 10 };
const cab = { "Resumo por tela": 5, "Leituras": 4, "Dados brutos": 4 };
const fmt = {
  "Resumo por tela": { B: "0", C: "0.0", D: "0.0", E: "0.0", F: "0.0", G: "0", H: "0.0", I: "0.0" },
  "Leituras": { B: "hh:mm:ss", C: "0", E: "0.0", F: "0.0", G: "0", H: "0.0", I: "0.0", J: "0.0", K: "0.0", L: "0.0", M: "0" },
  "Dados brutos": { B: "0.000", D: "0.000" },
};
const larg = {
  "Resumo por tela": [18, 10, 14, 11, 10, 10, 15, 11, 11],
  "Leituras": [6, 10, 11, 15, 11, 11, 14, 9, 9, 9, 9, 9, 11, 10, 11, 10],
  "Dados brutos": [9, 18, 26, 16, 15, 15, 11, 11, 10, 11, 8, 10, 18],
};
for (const n of order) {
  const ws = wb.addWorksheet(n);
  larg[n].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  sheets[n].forEach((row, r) => row.forEach((c, ci) => {
    if (c === null || c === undefined) return;
    const cell = ws.getCell(r + 1, ci + 1);
    const col = cell.address.replace(/\d+/g, "");
    cell.value = typeof c === "object" ? { formula: c.f, result: c.result } : c;
    cell.font = { ...fonte };
    if (fmt[n][col] && r + 1 > cab[n]) cell.numFmt = fmt[n][col];
  }));
  ws.getCell(1, 1).font = { ...fonte, size: 12, bold: true };
  const hr = ws.getRow(cab[n]);
  hr.eachCell((cell) => {
    cell.font = { ...fonte, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
    cell.alignment = { wrapText: true, vertical: "middle" };
    cell.border = { bottom: { style: "thin" } };
  });
  hr.height = 42;
  ws.views = [{ state: "frozen", ySplit: cab[n] }];
}
const res = wb.getWorksheet("Resumo por tela");
for (let c = 1; c <= 9; c++) res.getCell(RT, c).font = { ...fonte, bold: true };
res.getCell(RT + 2, 1).font = { ...fonte, bold: true };
fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
wb.xlsx.writeFile(SAIDA).then(() => console.log(`planilha gravada: ${SAIDA}`));
