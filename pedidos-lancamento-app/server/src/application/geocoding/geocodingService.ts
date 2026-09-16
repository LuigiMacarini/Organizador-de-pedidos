import * as customerRepository from "../../infrastructure/db/customerRepository.js";
import { geocodeAddress, type GeocodeLocationType } from "../../infrastructure/external/routingClient.js";

/**
 * ROOFTOP é o ponto exato do endereço; RANGE_INTERPOLATED é estimado entre
 * dois números conhecidos na mesma rua, mas ainda confiável. GEOMETRIC_CENTER
 * e APPROXIMATE não são específicos o bastante e viram PARTIAL, nunca
 * aceitos em silêncio como endereço exato.
 */
const PRECISE_LOCATION_TYPES = new Set<GeocodeLocationType>(["ROOFTOP", "RANGE_INTERPOLATED"]);

/**
 * Geocodifica o cliente e grava o resultado. Nunca lança erro para o
 * chamador: falha na geocodificação não pode impedir o cadastro do cliente,
 * é pré-requisito só para roteirização, não para pedidos.
 */
export async function geocodeCustomer(customerId: string): Promise<void> {
  const customer = await customerRepository.findById(customerId);
  if (!customer) return;

  if (!customer.city || !customer.state) {
    await customerRepository.setGeocodeResult(customerId, { status: "FAILED" });
    return;
  }

  try {
    const result = await geocodeAddress({
      street: customer.street,
      number: customer.number,
      neighborhood: customer.neighborhood,
      city: customer.city,
      state: customer.state,
      zipCode: customer.zipCode,
    });

    if (!result) {
      await customerRepository.setGeocodeResult(customerId, { status: "FAILED" });
      return;
    }

    const isPrecise = PRECISE_LOCATION_TYPES.has(result.locationType) && !result.partialMatch;
    await customerRepository.setGeocodeResult(customerId, {
      status: isPrecise ? "OK" : "PARTIAL",
      latitude: result.latitude,
      longitude: result.longitude,
    });
  } catch {
    await customerRepository.setGeocodeResult(customerId, { status: "FAILED" });
  }
}
