import type { FastifyInstance } from "fastify";
import * as deliveryService from "../../../application/routes/deliveryService.js";
import { updateDeliveryStatusInputSchema } from "../../../domain/route.js";
import { requireAuth } from "../plugins/authGuard.js";

export default async function deliveryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.patch<{ Params: { id: string } }>("/v1/deliveries/:id", async (request) => {
    const input = updateDeliveryStatusInputSchema.parse(request.body);
    return deliveryService.updateStatus(request.params.id, input);
  });
}
