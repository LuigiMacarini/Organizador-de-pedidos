import type { FastifyInstance } from "fastify";
import * as routeService from "../../../application/routes/routeService.js";
import { createRouteInputSchema, routeListQuerySchema } from "../../../domain/route.js";
import { requireAuth } from "../plugins/authGuard.js";

export default async function routeRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/v1/routes", async (request) => {
    const query = routeListQuerySchema.parse(request.query);
    return routeService.list(query);
  });

  app.get<{ Params: { id: string } }>("/v1/routes/:id", async (request) => {
    return routeService.get(request.params.id);
  });

  app.post("/v1/routes", async (request, reply) => {
    const input = createRouteInputSchema.parse(request.body);
    const route = await routeService.create(input, request.authUser!.id);
    return reply.status(201).send(route);
  });

  app.post<{ Params: { id: string } }>("/v1/routes/:id/start", async (request) => {
    return routeService.start(request.params.id);
  });

  app.post<{ Params: { id: string } }>("/v1/routes/:id/cancel", async (request) => {
    return routeService.cancel(request.params.id);
  });
}
