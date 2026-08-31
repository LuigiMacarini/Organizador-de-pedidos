import * as deliveryRepository from "../../infrastructure/db/deliveryRepository.js";
import * as orderRepository from "../../infrastructure/db/orderRepository.js";
import * as routeRepository from "../../infrastructure/db/routeRepository.js";
import { NotFoundError } from "../../domain/errors.js";
import { toDeliveryDTO, type UpdateDeliveryStatusInput } from "../../domain/route.js";

/**
 * Marca uma entrega como concluída ou falhada, sincroniza o status do
 * pedido correspondente e fecha a rota automaticamente quando não sobra
 * nenhuma entrega pendente (plano, §11).
 */
export async function updateStatus(id: string, input: UpdateDeliveryStatusInput) {
  const existing = await deliveryRepository.findById(id);
  if (!existing) throw new NotFoundError("Entrega não encontrada");

  const delivery = await deliveryRepository.updateStatus(id, input.status, input.notes);

  // DELIVERED fecha o pedido; FAILED devolve para PENDING, disponível para uma nova rota.
  await orderRepository.setStatus(delivery.orderId, input.status === "DELIVERED" ? "DELIVERED" : "PENDING");

  const pending = await deliveryRepository.countPending(delivery.routeId);
  if (pending === 0) {
    await routeRepository.setStatus(delivery.routeId, "COMPLETED", { completedAt: new Date() });
  }

  return toDeliveryDTO(delivery);
}
