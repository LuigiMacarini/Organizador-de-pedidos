import * as deliveryRepository from "../../infrastructure/db/deliveryRepository.js";
import * as orderRepository from "../../infrastructure/db/orderRepository.js";
import * as routeRepository from "../../infrastructure/db/routeRepository.js";
import { computeRouteMetrics } from "../../infrastructure/external/routingClient.js";
import { NotFoundError } from "../../domain/errors.js";
import { toDeliveryDTO, type UpdateDeliveryStatusInput } from "../../domain/route.js";

/**
 * Marca a entrega como concluída ou falhada, sincroniza o status do pedido e
 * fecha a rota automaticamente quando não sobra entrega pendente (plano, §11).
 * Recalcula km/tempo restantes só nesse caso: nunca por render, poll ou GPS.
 */
export async function updateStatus(id: string, input: UpdateDeliveryStatusInput) {
  const existing = await deliveryRepository.findById(id);
  if (!existing) throw new NotFoundError("Entrega não encontrada");

  const delivery = await deliveryRepository.updateStatus(id, input.status, input.notes);

  // DELIVERED fecha o pedido; FAILED devolve para PENDING, disponível para uma nova rota.
  await orderRepository.setStatus(delivery.orderId, input.status === "DELIVERED" ? "DELIVERED" : "PENDING");

  const remaining = await deliveryRepository.listPendingByRoute(delivery.routeId);

  if (remaining.length === 0) {
    // Rota terminou: zera as métricas sem chamar a Routes API de novo.
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
 * Sequência das paradas já está decidida (ordenada por sequence), então só
 * mede o trajeto: origem é a posição atual do entregador ou, se não
 * informada, onde a rota começou; destino é sempre a última parada restante
 * (rota de mão única, sem volta). Falha no Google Routes não trava a
 * confirmação da entrega, fica com os últimos valores conhecidos.
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
      : route.startLat !== null && route.startLng !== null
      ? { latitude: route.startLat, longitude: route.startLng }
      : null;
  if (!origin) return;

  const last = remaining[remaining.length - 1];
  const intermediates = remaining.slice(0, -1);
  const destination = { latitude: last.destinationLat, longitude: last.destinationLng };

  try {
    const metrics = await computeRouteMetrics(
      origin,
      intermediates.map((d) => ({ latitude: d.destinationLat, longitude: d.destinationLng })),
      destination
    );
    await routeRepository.updateMetrics(routeId, metrics);
  } catch {
    // Segue com os valores antigos, ver comentário acima.
  }
}
