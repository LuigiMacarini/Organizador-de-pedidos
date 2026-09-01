import type { FastifyInstance } from "fastify";
import * as placeService from "../../../application/places/placeService.js";
import { autocompleteQuerySchema, placeDetailsQuerySchema } from "../../../domain/place.js";
import { requireAuth } from "../plugins/authGuard.js";

export default async function placeRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/v1/places/autocomplete", async (request) => {
    const query = autocompleteQuerySchema.parse(request.query);
    return placeService.autocomplete(query.input);
  });

  app.get("/v1/places/details", async (request) => {
    const query = placeDetailsQuerySchema.parse(request.query);
    return placeService.details(query.placeId);
  });
}
