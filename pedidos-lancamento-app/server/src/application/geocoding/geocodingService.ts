import * as customerRepository from "../../infrastructure/db/customerRepository.js";
import { geocodeAddress } from "../../infrastructure/external/routingClient.js";

/**
 * Abaixo desse valor, o resultado é tratado como incerto (`PARTIAL`) em vez de
 * confirmado (`OK`). Calibrado contra endereços reais do ORG: um endereço
 * completo e existente bate com confiança 1.0; um resultado que caiu para o
 * nível "cidade" (ver `PRECISE_LAYERS` abaixo) ainda chega perto de 0.6 —
 * por isso a camada geográfica do resultado importa tanto quanto o número.
 */
const CONFIDENCE_THRESHOLD = 0.5;

/**
 * Camadas geográficas específicas o bastante para serem a localização de um
 * cliente. Testado contra o provedor real: um bairro que não bate
 * exatamente com o indexado (ex.: "Centro", comum a qualquer cidade) faz a
 * busca cair para `locality`/`region` — um ponto genérico no meio da cidade
 * ou do estado — mas ainda com confiança alta o bastante pra passar no
 * limiar acima sozinho. Por isso a camada é obrigatória, não só a confiança:
 * nunca aceitar em silêncio um resultado "cidade" como se fosse um endereço.
 */
const PRECISE_LAYERS = new Set(["venue", "address", "street"]);

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

    const isPrecise = result.confidence >= CONFIDENCE_THRESHOLD && PRECISE_LAYERS.has(result.layer);
    await customerRepository.setGeocodeResult(customerId, {
      status: isPrecise ? "OK" : "PARTIAL",
      latitude: result.latitude,
      longitude: result.longitude,
    });
  } catch {
    await customerRepository.setGeocodeResult(customerId, { status: "FAILED" });
  }
}
