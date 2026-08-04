import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@prisma/client";
import { verifyAccessToken } from "../../../infrastructure/auth/jwt.js";
import { UnauthorizedError, ForbiddenError } from "../../../domain/errors.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: { id: string; role: Role };
  }
}

/** Extrai e valida o Bearer token, populando `request.authUser`. Usar como `preHandler` global. */
export default fp(async (app) => {
  app.decorateRequest("authUser", undefined);

  app.addHook("preHandler", async (request: FastifyRequest) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return;
    try {
      const payload = verifyAccessToken(header.slice("Bearer ".length));
      request.authUser = { id: payload.sub, role: payload.role };
    } catch {
      // Token ausente/expirado: `requireAuth` decide se a rota exige login.
    }
  });
});

/** `preHandler` para rotas que exigem estar logado. */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  if (!request.authUser) throw new UnauthorizedError();
}

/** `preHandler` para rotas restritas a determinados papéis (implica `requireAuth`). */
export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.authUser) throw new UnauthorizedError();
    if (!roles.includes(request.authUser.role)) throw new ForbiddenError();
  };
}
