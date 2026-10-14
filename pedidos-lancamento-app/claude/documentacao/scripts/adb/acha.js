// Lê o XML do "uiautomator dump" e imprime "x y" do primeiro elemento cujo texto ou descrição combina com a expressão
// (sem diferenciar maiúsculas). Prefere elementos clicáveis. "id:<resource-id>" procura pelo identificador.
const xml = require("fs").readFileSync(0, "utf8");
const alvo = process.argv[2] || "";
const nos = [...xml.matchAll(/<node ([^>]*?)\/?>/g)].map((m) => {
  const a = Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
  const b = (a.bounds || "").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  return b ? { ...a, x: Math.round((+b[1] + +b[3]) / 2), y: Math.round((+b[2] + +b[4]) / 2), h: b[4] - b[2] } : null;
}).filter((n) => n && n.h > 20);
const combina = alvo.startsWith("id:")
  ? (n) => n["resource-id"] === alvo.slice(3)
  : (n) => { const re = new RegExp(alvo, "i"); return re.test(n.text || "") || re.test(n["content-desc"] || ""); };
const achados = nos.filter(combina);
const n = achados.find((x) => x.clickable === "true") || achados[0];
if (n) console.log(`${n.x} ${n.y}`);
