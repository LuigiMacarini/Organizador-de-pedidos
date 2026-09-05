import * as deliveryRepository from "../../infrastructure/db/deliveryRepository.js";
import * as orderRepository from "../../infrastructure/db/orderRepository.js";
import * as routeRepository from "../../infrastructure/db/routeRepository.js";
import { computeRouteMetrics } from "../../infrastructure/external/routingClient.js";
import { NotFoundError } from "../../domain/errors.js";
import { toDeliveryDTO, type UpdateDeliveryStatusInput } from "../../domain/route.js";

/**
 * Marca uma entrega como concluída ou falhada, sincroniza o status do
 * pedido correspondente e fecha a rota automaticamente quando não sobra
 * nenhuma entrega pendente (plano, §11). Também recalcula km/tempo
 * restantes da rota (só quando ainda sobra alguma entrega pendente — esse
 * é o único gatilho do recálculo, nunca por render/poll/GPS).
 */
export async function updateStatus(id: string, input: UpdateDeliveryStatusInput) {
  const existing = await deliveryRepository.findById(id);
  if (!existing) throw new NotFoundError("Entrega não encontrada");

  const delivery = await deliveryRepository.updateStatus(id, input.status, input.notes);

  // DELIVERED fecha o pedido; FAILED devolve para PENDING, disponível para uma nova rota.
  await orderRepository.setStatus(delivery.orderId, input.status === "DELIVERED" ? "DELIVERED" : "PENDING");

  const remaining = await deliveryRepository.listPendingByRoute(delivery.routeId);

  if (remaining.length === 0) {
    // Rota terminou: nada mais "resta" — zera métricas sem chamar a Routes API de novo.
    await routeRepository.setStatus(delivery.routeId, "COMPLETED", { completedAt: new Date() });
    await routeRepository.updateMetrics(delivery.routeId, {
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      geometry: null,
    });
  } else {
    await recalculateRemaining(delivery.routeId, remaining, input);
  }

  return toDeliveryDTO(delivery);
}

/**
 * Sequência das paradas restantes já está decidida (vem ordenada por
 * `sequence`) — não reotimiza, só mede o trajeto: origem = posição atual do
 * entregador quando informada pelo app, senão o depósito da rota; destino =
 * sempre o depósito (mesma definição de "total" usada na criação). Falha no
 * Google Routes não pode travar a confirmação da entrega — fica com os
 * últimos valores conhecidos (mesmo modo degradado da criação da rota).
 */
async function recalculateRemaining(
  routeId: string,
  remaining: { destinationLat: number; destinationLng: number }[],
  input: UpdateDeliveryStatusInput
) {
  const route = await routeRepository.findById(routeId);
  if (!route) return;

  const origin =
    input.currentLat !== undefined && input.currentLng !== undefined
      ? { latitude: input.currentLat, longitude: input.currentLng }
      : { latitude: route.originLat, longitude: route.originLng };
  const destination = { latitude: route.originLat, longitude: route.originLng };

  try {
    const metrics = await computeRouteMetrics(
      origin,
      remaining.map((d) => ({ latitude: d.destinationLat, longitude: d.destinationLng })),
      destination
    );
    await routeRepository.updateMetrics(routeId, metrics);
  } catch {
    // Segue com os valores antigos — ver comentário acima.
  }
}
