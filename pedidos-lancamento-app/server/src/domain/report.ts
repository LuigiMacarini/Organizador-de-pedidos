import { z } from "zod";
import { AppError } from "./errors.js";

export const monthlyClosingQuerySchema = z.object({
  /** "AAAA-MM" — sem informar, cai no mês atual do servidor. */
  month: z.string().regex(/^\d{4}-\d{2}$/, "Formato esperado: AAAA-MM").optional(),
});

export type MonthlyClosingQuery = z.infer<typeof monthlyClosingQuerySchema>;

export type MonthRange = { key: string; year: number; monthIndex: number; start: Date; end: Date };

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "2026-09" -> {key, year, monthIndex (0-11), start (inclusivo), end (exclusivo)}. */
export function resolveMonthRange(key: string): MonthRange {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) throw new AppError("Formato de mês inválido — use AAAA-MM", 400);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new AppError("Mês inválido", 400);
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  return { key, year, monthIndex, start, end };
}

export function monthKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey(): string {
  return monthKeyOf(new Date());
}

export function previousMonthKey(key: string): string {
  const { year, monthIndex } = resolveMonthRange(key);
  const prev = new Date(Date.UTC(year, monthIndex - 1, 1));
  return monthKeyOf(prev);
}

export function monthLabel(key: string): string {
  const { year, monthIndex } = resolveMonthRange(key);
  return `${MONTH_LABELS[monthIndex]} ${year}`;
}

/**
 * `null` quando não há base de comparação válida (mês anterior sem pedidos)
 * — nunca inventa uma porcentagem enganosa (ex.: "+Infinity%" ou tratar 0
 * como se fosse uma queda de 100% partindo de uma base que não existiu).
 */
export function computeVariationPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export type MonthlySummary = {
  revenue: number;
  orderCount: number;
  customerCount: number;
  productUnits: number;
  /** `null` quando `orderCount === 0` — não força ticket médio de uma base vazia. */
  avgTicket: number | null;
};

export type CustomerSummaryRow = {
  customerId: string;
  customerName: string;
  orderCount: number;
  total: number;
};

export type ProductSummaryRow = {
  productId: string;
  productName: string;
  unitsSold: number;
  revenue: number;
};

export type MonthComparison = {
  previousMonth: string | null;
  previousLabel: string | null;
  previousSummary: MonthlySummary | null;
  variation: {
    revenue: number | null;
    orderCount: number | null;
    customerCount: number | null;
    productUnits: number | null;
  };
};

export type MonthlyClosingDTO = {
  month: string;
  monthLabel: string;
  summary: MonthlySummary;
  byCustomer: CustomerSummaryRow[];
  byProduct: ProductSummaryRow[];
  comparison: MonthComparison;
  /** Meses (AAAA-MM) que realmente têm pedidos, mais recente primeiro — nunca inclui meses vazios artificialmente. */
  availableMonths: string[];
};
