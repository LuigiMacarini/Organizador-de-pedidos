import { apiRequest } from "./httpClient";
import type { MonthlyClosing } from "../types";

/** Resumo geral + por cliente + por produto + comparação com mês anterior + meses disponíveis, numa única requisição. */
export function remoteGetMonthlyClosing(month?: string): Promise<MonthlyClosing> {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return apiRequest<MonthlyClosing>(`/v1/reports/monthly-closing${query}`);
}
