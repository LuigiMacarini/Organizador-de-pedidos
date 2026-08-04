import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../../../domain/errors.js";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }
    if (error instanceof ZodError) {
      const message = error.issues.map((i) => i.message).join("; ");
      return reply.status(400).send({ error: message });
    }
    app.log.error(error);
    return reply.status(500).send({ error: "Erro interno" });
  });
}
