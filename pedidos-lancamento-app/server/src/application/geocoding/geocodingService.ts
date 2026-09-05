import * as customerRepository from "../../infrastructure/db/customerRepository.js";
import { geocodeAddress, type GeocodeLocationType } from "../../infrastructure/external/routingClient.js";

/**
 * `ROOFTOP` = ponto exato do endereço. `RANGE_INTERPOLATED` = estimado entre
 * dois números conhecidos na mesma rua — ainda confiável o bastante (bem
 * diferente do "centro da rua inteira" que o provedor anterior devolvia
 * como fallback). `GEOMETRIC_CENTER`/`APPROXIMATE` não são específicos o
 * bastante pra ser a localização de um cliente — viram `PARTIAL`, nunca
 * aceitos em silêncio como endereço exato.
 */
const PRECISE_LOCATION_TYPES = new Set<GeocodeLocationType>(["ROOFTOP", "RANGE_INTERPOLATED"]);

/**
 * Geocodifica um cliente já salvo e grava o resultado. Nunca lança para o
 * chamador — falha de geocodificação não pode impedir o cadastro do cliente
 * (a geocodificação é só um pré-requisito para roteirização, não para pedidos).
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
