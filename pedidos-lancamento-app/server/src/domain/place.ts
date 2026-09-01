import { z } from "zod";

export const autocompleteQuerySchema = z.object({
  input: z.string().trim().min(1),
});

export type AutocompleteQuery = z.infer<typeof autocompleteQuerySchema>;

// `placeId` vai em querystring, não em path param: o Google costuma gerar
// ids contendo "/", e o Fastify decodifica "%2F" antes de casar a rota,
// quebrando um `:placeId` de segmento único.
export const placeDetailsQuerySchema = z.object({
  placeId: z.string().trim().min(1),
});

export type PlaceDetailsQuery = z.infer<typeof placeDetailsQuerySchema>;
