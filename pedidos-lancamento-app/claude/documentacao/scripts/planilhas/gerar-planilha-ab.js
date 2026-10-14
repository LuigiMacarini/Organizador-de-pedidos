// Gera a planilha do teste de sobrecarga A/B (fórmulas reais) e verifica as fórmulas com o HyperFormula.
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { HyperFormula } = require("hyperformula");

const DADOS = path.join(__dirname, "..", "..", "dados", "teste-sobrecarga-ab-brutos");
const SAIDA = process.argv[2];
const read = (f) => fs.readFileSync(path.join(DADOS, f), "utf8").replace(/^﻿/, "");

// ---------- 1. Leitura dos dados brutos ----------
const rounds = fs.readdirSync(DADOS).filter((f) => /^r\d+_[AB]_cpu\.txt$/.test(f))
  .map((f) => { const [, n, b] = f.match(/^r(\d+)_([AB])_/); return { n: Number(n), b }; })
  .sort((x, y) => x.n - y.n);

const cpuRows = [];
const rssRows = [];
for (const r of rounds) {
  let t = null, amostra = 0, amostraRss = 0;
  for (const line of read(`r${r.n}_${r.b}_cpu.txt`).split(/\r?\n/)) {
    const mt = line.match(/^T (\d+(?:\.\d+)?)/);
    if (mt) { t = Number(mt[1]); continue; }
    const mr = line.match(/^VmRSS:\s+(\d+)\s+kB/);
    if (mr) { rssRows.push({ n: r.n, b: r.b, amostra: ++amostraRss, t, kb: Number(mr[1]) }); continue; }
    if (t !== null && line.includes(") ")) {
      const rest = line.slice(line.lastIndexOf(")") + 2).trim().split(/\s+/);
      cpuRows.push({ n: r.n, b: r.b, amostra: ++amostra, t, ticks: Number(rest[11]) + Number(rest[12]) });
    }
  }
  const info = read(`r${r.n}_${r.b}_info.txt`);
  // Início = primeira amostra de CPU (mesmo relógio para todas; o "inicio=" da rodada 6 veio vazio do adb).
  r.inicio = cpuRows.find((x) => x.n === r.n).t;
  r.foco = /pedidoslancamento/.test(info.match(/foco=\[(.*?)\]/)[1]) ? "sim" : "não";
  r.termico = Number(info.match(/Thermal Status:\s*(\d+)/)[1]);
  r.bateria = Number(info.match(/level:\s*(\d+)/)[1]);
  r.pssKb = Number(read(`r${r.n}_${r.b}_meminfo.txt`).match(/TOTAL PSS:\s+(\d+)/)[1]);
  r.inicioLocal = new Date(r.inicio * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// ---------- 2. Conteúdo das abas (fonte única para ExcelJS e HyperFormula) ----------
// Célula: número, texto, null ou { f: "FÓRMULA sem =" }.
const F = (f) => ({ f });
const CPU = "'CPU por amostra'";
const sheets = {};

// Aba CPU por amostra
const cpu = [
  ["Dados brutos de CPU: /proc/<pid>/stat a cada ~1,1 s (pausa de 1 s + tempo da leitura), lido pelo shell do adb, fora do app"],
  ["utime+stime em ticks do kernel; CPU no intervalo = Δticks ÷ CLK_TCK ÷ Δt × 100 (% de um núcleo)", null, null, null, null, "CLK_TCK (ticks/s):", 100],
  [],
  ["Rodada", "Build", "Amostra", "Instante (s, relógio do aparelho)", "Tempo desde o início (s)", "utime+stime (ticks)", "CPU no intervalo (% de um núcleo)"],
];
const firstCpuRow = {}, lastCpuRow = {};
cpuRows.forEach((s) => {
  const row = cpu.length + 1;
  if (!(s.n in firstCpuRow)) firstCpuRow[s.n] = row;
  lastCpuRow[s.n] = row;
  const first = firstCpuRow[s.n];
  cpu.push([s.n, s.b, s.amostra, s.t, F(`D${row}-D${first}`), s.ticks,
    row === first ? null : F(`(F${row}-F${row - 1})/$G$2/(D${row}-D${row - 1})*100`)]);
});
sheets["CPU por amostra"] = cpu;

// Aba RSS
const rss = [
  ["Dados brutos de memória residente: VmRSS de /proc/<pid>/status a cada 10 amostras de CPU (~11 s), lido pelo shell do adb"],
  ["RSS (MB) = kB × 1024 ÷ 1.000.000 (megabytes decimais)"],
  [],
  ["Rodada", "Build", "Amostra", "Instante (s, relógio do aparelho)", "VmRSS (kB)", "RSS (MB)"],
];
const firstRssRow = {}, lastRssRow = {};
rssRows.forEach((s) => {
  const row = rss.length + 1;
  if (!(s.n in firstRssRow)) firstRssRow[s.n] = row;
  lastRssRow[s.n] = row;
  rss.push([s.n, s.b, s.amostra, s.t, s.kb, F(`E${row}*1024/1000000`)]);
});
sheets["RSS"] = rss;

// Aba Rodadas
const rod = [
  ["Resultados por rodada: 6 rodadas na ordem A B A B B A; em cada uma, 180 amostras de CPU (~195 s) sem toque, após 60 s de estabilização"],
  ["Build A = app sem medição (sem Sentry e sem coletor) · Build B = build do experimento (Sentry com tracing + coletor de 15 s)"],
  [],
  ["Rodada", "Build", "Início da medição (horário de Brasília)", "CPU média (% de um núcleo)", "CPU máxima entre duas amostras (% de um núcleo)",
    "RSS médio (MB)", "PSS final (kB, dumpsys)", "PSS final (MB)", "Duração medida (s)", "Amostras de CPU",
    "App em primeiro plano", "Estado térmico (0 = normal)", "Bateria (%)",
    "Aux.: (CPU − média do build)²", "Aux.: (RSS − média do build)²", "Aux.: (PSS − média do build)²"],
];
rounds.forEach((r) => {
  const row = rod.length + 1;
  const a = firstCpuRow[r.n], z = lastCpuRow[r.n], ra = firstRssRow[r.n], rz = lastRssRow[r.n];
  rod.push([
    r.n, r.b, r.inicioLocal,
    F(`(${CPU}!F${z}-${CPU}!F${a})/${CPU}!$G$2/(${CPU}!D${z}-${CPU}!D${a})*100`),
    F(`MAX(${CPU}!G${a}:G${z})`),
    F(`AVERAGE(RSS!F${ra}:F${rz})`),
    r.pssKb,
    F(`G${row}*1024/1000000`),
    F(`${CPU}!D${z}-${CPU}!D${a}`),
    F(`COUNT(${CPU}!D${a}:D${z})`),
    r.foco, r.termico, r.bateria,
    F(`(D${row}-AVERAGEIF($B$5:$B$10,B${row},D$5:D$10))^2`),
    F(`(F${row}-AVERAGEIF($B$5:$B$10,B${row},F$5:F$10))^2`),
    F(`(H${row}-AVERAGEIF($B$5:$B$10,B${row},H$5:H$10))^2`),
  ]);
});
sheets["Rodadas"] = rod;

// Aba Resumo
const res = [
  ["Teste de sobrecarga do instrumento (A/B): ORG no Android (Samsung Galaxy A54 5G)"],
  ["Pergunta: medir CPU, memória e FPS dentro do próprio app compromete o desempenho? (efeito do observador)"],
  ["Build A = app sem medição · Build B = build do experimento (Sentry + coletor de 15 s) · medição externa via adb · 3 rodadas por build"],
  [],
  ["Métrica", "n (A)", "Média A", "Desvio padrão A", "n (B)", "Média B", "Desvio padrão B",
    "Diferença (B − A)", "Diferença relativa", "t de Welch", "Graus de liberdade (Welch)", "p (bicaudal)"],
];
for (const [label, col, aux] of [["CPU média (% de um núcleo)", "D", "N"], ["RSS médio (MB)", "F", "O"], ["PSS final (MB)", "H", "P"]]) {
  const r = res.length + 1;
  res.push([
    label,
    F(`COUNTIF(Rodadas!$B$5:$B$10,"A")`),
    F(`AVERAGEIF(Rodadas!$B$5:$B$10,"A",Rodadas!${col}$5:${col}$10)`),
    F(`SQRT(SUMIF(Rodadas!$B$5:$B$10,"A",Rodadas!${aux}$5:${aux}$10)/(B${r}-1))`),
    F(`COUNTIF(Rodadas!$B$5:$B$10,"B")`),
    F(`AVERAGEIF(Rodadas!$B$5:$B$10,"B",Rodadas!${col}$5:${col}$10)`),
    F(`SQRT(SUMIF(Rodadas!$B$5:$B$10,"B",Rodadas!${aux}$5:${aux}$10)/(E${r}-1))`),
    F(`F${r}-C${r}`),
    F(`H${r}/C${r}`),
    F(`H${r}/SQRT(D${r}^2/B${r}+G${r}^2/E${r})`),
    F(`(D${r}^2/B${r}+G${r}^2/E${r})^2/((D${r}^2/B${r})^2/(B${r}-1)+(G${r}^2/E${r})^2/(E${r}-1))`),
    F(`_xlfn.BETA.DIST(K${r}/(K${r}+J${r}^2),K${r}/2,0.5,TRUE())`),
  ]);
}
res.push([]);
res.push(["Leitura (06/10/2026)"]);
res.push(["A medição dentro do app acrescentou cerca de 0,6 ponto percentual de CPU e 4 MB de memória residente. As diferenças não são significativas (p > 0,05) e têm a mesma ordem de grandeza da variação entre rodadas do mesmo build."]);
res.push([]);
res.push(["Observações"]);
for (const t of [
  "CPU em % de um núcleo: 100% = um núcleo inteiro ocupado (o A54 tem 8 núcleos).",
  "p bicaudal da distribuição t com os graus de liberdade de Welch (fracionários): p = BETA.DIST(gl ÷ (gl + t²); gl ÷ 2; 0,5; VERDADEIRO). A função DIST.T.BC (T.DIST.2T) do Excel truncaria os graus de liberdade.",
  "Com 3 rodadas por build o poder estatístico é baixo: o resultado indica sobrecarga pequena e indistinguível da variação natural, e não sobrecarga zero.",
  "O instrumento está nas builds do experimento das duas plataformas, então seu custo não favorece Android nem iOS na comparação.",
  "Condições: estado térmico 0 em todas as rodadas; bateria de 66 a 69% (carregando pelo USB, igual para A e B); tela a 60 Hz; app parado na lista de Pedidos.",
  "Rastreabilidade: dados brutos nas abas 'CPU por amostra' e 'RSS'; resultados por rodada na aba 'Rodadas'; procedimento na aba 'Método'.",
]) res.push([t]);
sheets["Resumo"] = res;

// Aba Método
const met = [
  ["Método do teste de sobrecarga (A/B)"],
  [],
  ["Item", "Descrição"],
  ["Objetivo", "Medir de fora do app quanto CPU e memória a instrumentação (Sentry + coletor de 15 s) acrescenta, para responder ao efeito do observador."],
  ["Aparelho", "Samsung Galaxy A54 5G, tela em 60 Hz (Suavidade de movimentos: Padrão), conectado por USB ao PC e carregando."],
  ["Build A", "App sem medição: build local sem o DSN do Sentry. Sem DSN o Sentry fica inerte (não monta integrações nem inicializa o SDK nativo) e o coletor não liga. Ausência do DSN conferida no APK; cache do Metro limpo antes da build."],
  ["Build B", "Build do experimento: Sentry com tracing a 100% + coletor de CPU, memória e FPS a cada 15 s (commit 14733be)."],
  ["Ordem", "A B A B B A (contrabalançada, para distribuir igualmente variações ao longo do tempo, como temperatura e bateria)."],
  ["Rodada", "Instalação da build; app fechado; 30 s de pausa; abertura a frio; 60 s de estabilização na lista de Pedidos; 180 amostras de CPU (~195 s) sem toque; PSS por dumpsys no fim."],
  ["CPU", "/proc/<pid>/stat (utime + stime), a mesma fonte do top, lido pelo shell do adb, fora do app, a cada ~1,1 s (pausa de 1 s + leitura). A média da rodada divide os ticks pelo tempo real decorrido, então o intervalo não precisa ser exato."],
  ["Memória", "VmRSS de /proc/<pid>/status a cada 10 amostras de CPU (~11 s); PSS total por dumpsys meminfo uma vez no fim (fora da janela de CPU, porque o dumpsys faz o app trabalhar)."],
  ["Validade", "Rodada válida se tiver ≥ 175 amostras de CPU, o mesmo PID do início ao fim e o app em primeiro plano. Na série final, só a rodada 3 foi repetida (a 1ª tentativa parou em 49 amostras). Duas séries anteriores, interrompidas pela perda do aparelho no adb, foram descartadas inteiras."],
  ["Estatística", "Média e desvio padrão amostral por build; diferença B − A; teste t de Welch (variâncias desiguais), p bicaudal."],
  ["Limitações", "3 rodadas por build (poder estatístico baixo); medição externa só no Android, porque no iOS exigiria macOS; aparelho carregando pelo USB durante o teste."],
  ["Observação operacional", "O servidor do adb no Windows perdeu o aparelho depois de ~10 min em algumas tentativas, mesmo com o USB ativo. Reiniciar o servidor resolveu, e o script passou a repetir rodadas inválidas."],
];
sheets["Método"] = met;

// ---------- 3. Cálculo e verificação das fórmulas com o HyperFormula ----------
const order = ["Resumo", "Rodadas", "CPU por amostra", "RSS", "Método"];
const hfInput = {};
for (const name of order) {
  hfInput[name] = sheets[name].map((row) => row.map((c) => (c && typeof c === "object" ? "=" + c.f.replace(/_xlfn\./g, "") : c ?? null)));
}
const hf = HyperFormula.buildFromSheets(hfInput, { licenseKey: "gpl-v3" });
const sheetId = (name) => hf.getSheetId(name);
const valueAt = (name, r, c) => hf.getCellValue({ sheet: sheetId(name), row: r, col: c });

let erros = 0, formulas = 0;
for (const name of order) {
  sheets[name].forEach((row, r) => row.forEach((c, ci) => {
    if (c && typeof c === "object") {
      formulas++;
      const v = valueAt(name, r, ci);
      if (v && typeof v === "object") { erros++; console.log(`ERRO ${name}!${String.fromCharCode(65 + ci)}${r + 1}: ${v.type} ${v.message ?? ""}`); }
      c.result = v;
    }
  }));
}
console.log(`fórmulas: ${formulas} | erros: ${erros}`);

// Conferência independente (mesma lógica da análise anterior, sem planilha).
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const exp = rounds.map((r) => {
  const s = cpuRows.filter((x) => x.n === r.n), m = rssRows.filter((x) => x.n === r.n);
  return {
    cpu: ((s[s.length - 1].ticks - s[0].ticks) / 100 / (s[s.length - 1].t - s[0].t)) * 100,
    rss: mean(m.map((x) => x.kb * 1024 / 1e6)),
    pss: r.pssKb * 1024 / 1e6,
  };
});
let maxDiff = 0;
rounds.forEach((r, i) => {
  const row = 4 + i;
  for (const [col, k] of [[3, "cpu"], [5, "rss"], [7, "pss"]]) maxDiff = Math.max(maxDiff, Math.abs(valueAt("Rodadas", row, col) - exp[i][k]));
});
console.log(`maior diferença entre fórmula e cálculo independente (por rodada): ${maxDiff.toExponential(2)}`);
console.log("Resumo (calculado pelas fórmulas):");
for (let r = 5; r <= 7; r++) {
  const v = (c) => valueAt("Resumo", r, c);
  console.log(`  ${v(0)} | A=${v(2).toFixed(2)} ± ${v(3).toFixed(2)} | B=${v(5).toFixed(2)} ± ${v(6).toFixed(2)} | B−A=${v(7).toFixed(2)} (${(v(8) * 100).toFixed(1)}%) | t=${v(9).toFixed(2)} | gl=${v(10).toFixed(1)} | p=${v(11).toFixed(2)}`);
}

// ---------- 4. Escrita do .xlsx com ExcelJS ----------
const wb = new ExcelJS.Workbook();
wb.creator = "LuigiMacarini";
wb.created = new Date();
wb.calcProperties = { fullCalcOnLoad: true };
const fonte = { name: "Arial", size: 10 };
const fmt = {
  "Resumo": { B: "0", C: "0.00", D: "0.00", E: "0", F: "0.00", G: "0.00", H: "0.00", I: "0.0%", J: "0.00", K: "0.0", L: "0.00" },
  "Rodadas": { D: "0.00", E: "0.0", F: "0.0", G: "#,##0", H: "0.0", I: "0.0", N: "0.0000", O: "0.0000", P: "0.0000" },
  "CPU por amostra": { D: "0.000", E: "0.0", F: "#,##0", G: "0.00" },
  "RSS": { D: "0.000", E: "#,##0", F: "0.0" },
  "Método": {},
};
const larguras = {
  "Resumo": [34, 8, 11, 15, 8, 11, 15, 16, 14, 11, 14, 12],
  "Rodadas": [9, 7, 22, 15, 17, 13, 15, 12, 14, 12, 14, 15, 10, 16, 16, 16],
  "CPU por amostra": [9, 7, 9, 22, 16, 18, 20],
  "RSS": [9, 7, 9, 22, 12, 10],
  "Método": [22, 120],
};
const headerRow = { "Resumo": 5, "Rodadas": 4, "CPU por amostra": 4, "RSS": 4, "Método": 3 };

for (const name of order) {
  const ws = wb.addWorksheet(name);
  larguras[name].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  sheets[name].forEach((row, r) => row.forEach((c, ci) => {
    if (c === null || c === undefined) return;
    const cell = ws.getCell(r + 1, ci + 1);
    const col = cell.address.replace(/\d+/g, "");
    cell.value = typeof c === "object" ? { formula: c.f, result: c.result } : c;
    cell.font = { ...fonte };
    if (fmt[name][col] && r + 1 > headerRow[name]) cell.numFmt = fmt[name][col];
    if (name === "Método" && ci === 1) cell.alignment = { wrapText: true, vertical: "top" };
  }));
  ws.getCell(1, 1).font = { ...fonte, size: 12, bold: true };
  const hr = ws.getRow(headerRow[name]);
  hr.eachCell((cell) => {
    cell.font = { ...fonte, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
    cell.alignment = { wrapText: true, vertical: "middle" };
    cell.border = { bottom: { style: "thin" } };
  });
  hr.height = 42;
  ws.views = [{ state: "frozen", ySplit: headerRow[name] }];
}
const resumo = wb.getWorksheet("Resumo");
for (const r of [10, 13]) resumo.getCell(r, 1).font = { ...fonte, bold: true };
wb.getWorksheet("CPU por amostra").getCell("G2").note = "Valor de getconf CLK_TCK no Galaxy A54 (ticks do kernel por segundo).";
wb.getWorksheet("Rodadas").getCell("G4").note = "Valor de TOTAL PSS do dumpsys meminfo ao fim de cada rodada (fonte: arquivos rN_X_meminfo.txt).";

fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
wb.xlsx.writeFile(SAIDA).then(() => console.log(`planilha gravada: ${SAIDA}`));
