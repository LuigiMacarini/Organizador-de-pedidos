import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../../../domain/errors.js";

/** Erros do próprio Fastify (ex.: `FST_ERR_CTP_EMPTY_JSON_BODY`) já carregam um `statusCode` de cliente. */
function hasClientStatusCode(error: unknown): error is Error & { statusCode: number } {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number" &&
    (error as { statusCode: number }).statusCode >= 400 &&
    (error as { statusCode: number }).statusCode < 500
  );
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }
    if (error instanceof ZodError) {
      const message = error.issues.map((i) => i.message).join("; ");
      return reply.status(400).send({ error: message });
    }
    // Respeitar o statusCode do próprio Fastify em vez de sempre cair em 500
    // genérico, que escondia a causa real (ver FST_ERR_CTP_EMPTY_JSON_BODY).
    if (hasClientStatusCode(error)) {
      return reply.status(error.statusCode).send({ error: error.message });
    }
    app.log.error(error);
    return reply.status(500).send({ error: "Erro interno" });
  });
}
