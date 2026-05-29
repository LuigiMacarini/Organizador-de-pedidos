export type CsvCustomerRow = {
  name: string;
  contact?: string;
};

export type CsvParseResult = {
  rows: CsvCustomerRow[];
  /** Linhas ignoradas por estarem vazias ou sem nome. */
  skipped: number;
};

function detectDelimiter(headerLine: string): string {
  const comma = (headerLine.match(/,/g) ?? []).length;
  const semicolon = (headerLine.match(/;/g) ?? []).length;
  return semicolon > comma ? ";" : ",";
}

/** Quebra uma linha CSV respeitando aspas duplas. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((c) => c.trim());
}

function looksLikeHeader(cells: string[]): boolean {
  const first = (cells[0] ?? "").toLowerCase();
  return first === "nome" || first === "name" || first === "cliente";
}

/**
 * Faz o parse de um CSV com colunas `Nome, Contato` (cabeçalho na primeira linha).
 * Aceita `,` ou `;` como separador e ignora linhas sem nome.
 */
export function parseCustomersCsv(content: string): CsvParseResult {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const nonEmpty = normalized.split("\n").filter((l) => l.trim() !== "");
  if (nonEmpty.length === 0) return { rows: [], skipped: 0 };

  const delimiter = detectDelimiter(nonEmpty[0]);

  let startIndex = 0;
  const firstCells = splitLine(nonEmpty[0], delimiter);
  if (looksLikeHeader(firstCells)) startIndex = 1;

  const rows: CsvCustomerRow[] = [];
  let skipped = 0;

  for (let i = startIndex; i < nonEmpty.length; i += 1) {
    const cells = splitLine(nonEmpty[i], delimiter);
    const name = (cells[0] ?? "").trim();
    if (!name) {
      skipped += 1;
      continue;
    }
    const contact = (cells[1] ?? "").trim();
    rows.push({ name, contact: contact || undefined });
  }

  return { rows, skipped };
}
