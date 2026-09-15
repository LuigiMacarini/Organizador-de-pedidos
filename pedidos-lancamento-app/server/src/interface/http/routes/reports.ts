import type { FastifyInstance } from "fastify";
import * as reportService from "../../../application/reports/reportService.js";
import { monthlyClosingQuerySchema } from "../../../domain/report.js";
import { requireAuth } from "../plugins/authGuard.js";

export default async function reportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  /** Resumo geral + por cliente + por produto + comparação com mês anterior + meses disponíveis, tudo numa resposta. */
  app.get("/v1/reports/monthly-closing", async (request) => {
    const query = monthlyClosingQuerySchema.parse(request.query);
    return reportService.getMonthlyClosing(query.month);
  });
}
