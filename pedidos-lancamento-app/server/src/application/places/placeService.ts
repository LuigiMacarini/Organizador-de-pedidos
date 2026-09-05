import { NotFoundError } from "../../domain/errors.js";
import { autocompleteAddress, getPlaceDetails } from "../../infrastructure/external/routingClient.js";

export function autocomplete(input: string) {
  return autocompleteAddress(input);
}

export async function details(placeId: string) {
  const result = await getPlaceDetails(placeId);
  if (!result) throw new NotFoundError("Endereço não encontrado");
  return result;
}
