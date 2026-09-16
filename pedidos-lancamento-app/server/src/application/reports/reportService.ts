import * as reportRepository from "../../infrastructure/db/reportRepository.js";
import {
  computeVariationPct,
  currentMonthKey,
  monthLabel,
  previousMonthKey,
  resolveMonthRange,
  type MonthlyClosingDTO,
} from "../../domain/report.js";

/**
 * Dispara em paralelo as consultas do mês atual e do anterior (Promise.all).
 * É a única chamada que a tela de fechamento faz: resumo, por cliente, por
 * produto, comparação e meses disponíveis vêm todos juntos.
 */
export async function getMonthlyClosing(monthParam?: string): Promise<MonthlyClosingDTO> {
  const key = monthParam ?? currentMonthKey();
  const { start, end } = resolveMonthRange(key);
  const prevKey = previousMonthKey(key);
  const prevRange = resolveMonthRange(prevKey);

  const [summary, byCustomer, byProduct, previousSummary, availableMonths] = await Promise.all([
    reportRepository.getMonthlySummary(start, end),
    reportRepository.getByCustomer(start, end),
    reportRepository.getByProduct(start, end),
    reportRepository.getMonthlySummary(prevRange.start, prevRange.end),
    reportRepository.getAvailableMonths(),
  ]);

  // Sem pedido no mês anterior não há o que comparar, mesmo a consulta
  // sempre devolvendo um objeto zerado.
  const hasPreviousData = previousSummary.orderCount > 0;

  return {
    month: key,
    monthLabel: monthLabel(key),
    summary,
    byCustomer,
    byProduct,
    comparison: {
      previousMonth: hasPreviousData ? prevKey : null,
      previousLabel: hasPreviousData ? monthLabel(prevKey) : null,
      previousSummary: hasPreviousData ? previousSummary : null,
      variation: {
        revenue: hasPreviousData ? computeVariationPct(summary.revenue, previousSummary.revenue) : null,
        orderCount: hasPreviousData
          ? computeVariationPct(summary.orderCount, previousSummary.orderCount)
          : null,
        customerCount: hasPreviousData
          ? computeVariationPct(summary.customerCount, previousSummary.customerCount)
          : null,
        productUnits: hasPreviousData
          ? computeVariationPct(summary.productUnits, previousSummary.productUnits)
          : null,
      },
    },
    availableMonths,
  };
}
