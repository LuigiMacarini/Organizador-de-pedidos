import * as customerRepository from "../../infrastructure/db/customerRepository.js";
import { geocodeAddress } from "../../infrastructure/external/routingClient.js";

/**
 * Abaixo desse valor, o resultado é tratado como incerto (`PARTIAL`) em vez de
 * confirmado (`OK`). Sem base empírica ainda — calibrar observando os
 * primeiros clientes reais do ORG (endereços informais/rurais tendem a vir
 * com confiança mais baixa nesse provedor).
 */
const CONFIDENCE_THRESHOLD = 0.5;

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

    await customerRepository.setGeocodeResult(customerId, {
      status: result.confidence >= CONFIDENCE_THRESHOLD ? "OK" : "PARTIAL",
      latitude: result.latitude,
      longitude: result.longitude,
    });
  } catch {
    await customerRepository.setGeocodeResult(customerId, { status: "FAILED" });
  }
}
