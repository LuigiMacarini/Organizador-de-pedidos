// Conferência independente do p: integra numericamente a densidade t de Student (gl fracionário).
const ExcelJS = require("exceljs");
const lnGamma = (z) => { // Lanczos (g = 7)
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1; let x = c[0]; for (let i = 1; i < 9; i++) x += c[i] / (z + i);
  const t = z + 7.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
};
const pdf = (x, v) => Math.exp(lnGamma((v + 1) / 2) - lnGamma(v / 2) - 0.5 * Math.log(v * Math.PI) - ((v + 1) / 2) * Math.log(1 + x * x / v));
const pBicaudal = (t, v) => { // p = 1 - 2 * integral de 0 a |t| (Simpson, 20000 intervalos)
  const n = 20000, a = 0, b = Math.abs(t), h = (b - a) / n; let s = pdf(a, v) + pdf(b, v);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * pdf(a + i * h, v);
  return 1 - 2 * (s * h / 3);
};
(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(process.argv[2]);
  const ws = wb.getWorksheet("Resumo");
  for (let r = 6; r <= 8; r++) {
    const g = (c) => ws.getCell(`${c}${r}`).value.result;
    console.log(`${ws.getCell(`A${r}`).value}: t=${g("J").toFixed(4)} gl=${g("K").toFixed(4)} | p planilha=${g("L").toFixed(6)} | p integração=${pBicaudal(g("J"), g("K")).toFixed(6)} | fórmula L${r}: ${ws.getCell(`L${r}`).value.formula}`);
  }
})();
