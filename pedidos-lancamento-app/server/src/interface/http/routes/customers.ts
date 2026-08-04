import type { FastifyInstance } from "fastify";
import * as customerService from "../../../application/customers/customerService.js";
import { customerInputSchema } from "../../../domain/customer.js";
import { paginationQuerySchema } from "../../../domain/pagination.js";
import { requireAuth } from "../plugins/authGuard.js";

export default async function customerRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/v1/customers", async (request) => {
    const query = paginationQuerySchema.parse(request.query);
    return customerService.list(query);
  });

  app.get<{ Params: { id: string } }>("/v1/customers/:id", async (request) => {
    return customerService.get(request.params.id);
  });

  app.post("/v1/customers", async (request, reply) => {
    const input = customerInputSchema.parse(request.body);
    const customer = await customerService.create(input);
    return reply.status(201).send(customer);
  });

  app.patch<{ Params: { id: string } }>("/v1/customers/:id", async (request) => {
    const input = customerInputSchema.parse(request.body);
    return customerService.update(request.params.id, input);
  });

  app.delete<{ Params: { id: string } }>("/v1/customers/:id", async (request, reply) => {
    await customerService.remove(request.params.id);
    return reply.status(204).send();
  });
}
