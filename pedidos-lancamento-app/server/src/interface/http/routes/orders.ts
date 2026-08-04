import type { FastifyInstance } from "fastify";
import * as orderService from "../../../application/orders/orderService.js";
import {
  createOrderInputSchema,
  orderListQuerySchema,
  updateOrderInputSchema,
} from "../../../domain/order.js";
import { requireAuth } from "../plugins/authGuard.js";

export default async function orderRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/v1/orders", async (request) => {
    const query = orderListQuerySchema.parse(request.query);
    return orderService.list(query);
  });

  app.get<{ Params: { id: string } }>("/v1/orders/:id", async (request) => {
    return orderService.get(request.params.id);
  });

  app.post("/v1/orders", async (request, reply) => {
    const input = createOrderInputSchema.parse(request.body);
    const order = await orderService.create(input);
    return reply.status(201).send(order);
  });

  app.patch<{ Params: { id: string } }>("/v1/orders/:id", async (request) => {
    const input = updateOrderInputSchema.parse(request.body);
    return orderService.update(request.params.id, input);
  });

  /** Substitui o antigo "fechar mês" (que apagava pedidos): arquiva mantendo o histórico. */
  app.post<{ Params: { id: string } }>("/v1/orders/:id/archive", async (request) => {
    return orderService.archive(request.params.id);
  });

  app.post<{ Params: { id: string } }>("/v1/orders/:id/unarchive", async (request) => {
    return orderService.unarchive(request.params.id);
  });
}
