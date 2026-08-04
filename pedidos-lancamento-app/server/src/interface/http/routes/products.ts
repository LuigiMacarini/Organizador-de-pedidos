import type { FastifyInstance } from "fastify";
import * as productService from "../../../application/products/productService.js";
import { productInputSchema } from "../../../domain/product.js";
import { paginationQuerySchema } from "../../../domain/pagination.js";
import { requireAuth, requireRole } from "../plugins/authGuard.js";

export default async function productRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  /** Catálogo para montar pedidos — qualquer usuário logado (Dono ou funcionário). */
  app.get("/v1/products", async () => {
    return productService.listActive();
  });

  /** Lista administrável (inclui inativos, paginada) — só o Dono. */
  app.get("/v1/products/manage", { preHandler: requireRole("OWNER") }, async (request) => {
    const query = paginationQuerySchema.parse(request.query);
    return productService.listAll(query);
  });

  app.post("/v1/products", { preHandler: requireRole("OWNER") }, async (request, reply) => {
    const input = productInputSchema.parse(request.body);
    const product = await productService.create(input);
    return reply.status(201).send(product);
  });

  app.patch<{ Params: { id: string } }>(
    "/v1/products/:id",
    { preHandler: requireRole("OWNER") },
    async (request) => {
      const input = productInputSchema.parse(request.body);
      return productService.update(request.params.id, input);
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/v1/products/:id",
    { preHandler: requireRole("OWNER") },
    async (request) => {
      return productService.deactivate(request.params.id);
    }
  );
}
