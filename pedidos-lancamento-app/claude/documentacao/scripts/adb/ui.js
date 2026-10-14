// Lê o XML do "uiautomator dump" e lista os elementos com texto, descrição ou clicáveis, com o centro (x,y).
const xml = require("fs").readFileSync(0, "utf8");
const filtro = (process.argv[2] || "").toLowerCase();
const nos = [...xml.matchAll(/<node ([^>]*?)\/?>/g)].map((m) => {
  const a = Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
  const b = (a.bounds || "").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  return b ? { ...a, x: Math.round((+b[1] + +b[3]) / 2), y: Math.round((+b[2] + +b[4]) / 2), w: b[3] - b[1], h: b[4] - b[2] } : null;
}).filter(Boolean);
for (const n of nos) {
  const t = n.text || "", d = n["content-desc"] || "";
  if (!t && !d && n.clickable !== "true" && !/EditText/.test(n.class)) continue;
  const linha = `(${n.x},${n.y}) ${n.w}x${n.h} ${n.class.split(".").pop()}${n.clickable === "true" ? " [clica]" : ""}${n.scrollable === "true" ? " [rola]" : ""} text="${t}" desc="${d}"${n.hint ? ` hint="${n.hint}"` : ""}`;
  if (!filtro || linha.toLowerCase().includes(filtro)) console.log(linha);
}
