import type { FastifyInstance } from "fastify";
import * as authService from "../../../application/auth/authService.js";
import { loginInputSchema, refreshInputSchema } from "../../../domain/auth.js";
import { requireAuth } from "../plugins/authGuard.js";

export default async function authRoutes(app: FastifyInstance) {
  app.post("/v1/auth/login", async (request, reply) => {
    const input = loginInputSchema.parse(request.body);
    const result = await authService.login(input);
    return reply.status(200).send(result);
  });

  app.post("/v1/auth/refresh", async (request, reply) => {
    const input = refreshInputSchema.parse(request.body);
    const result = await authService.refresh(input.refreshToken);
    return reply.status(200).send(result);
  });

  app.get("/v1/auth/me", { preHandler: requireAuth }, async (request) => {
    return authService.me(request.authUser!.id);
  });
}
