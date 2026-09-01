import * as orderRepository from "../../infrastructure/db/orderRepository.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import {
  resolveStatusFilter,
  toOrderDTO,
  type CreateOrderInput,
  type OrderStatusFilter,
  type UpdateOrderInput,
} from "../../domain/order.js";
import { toPage, type PaginationQuery } from "../../domain/pagination.js";

export async function list(query: PaginationQuery & { status: OrderStatusFilter }) {
  const rows = await orderRepository.list({
    cursor: query.cursor,
    limit: query.limit,
    statuses: resolveStatusFilter(query.status),
    deliverableOnly: query.status === "deliverable",
  });
  return toPage(rows, query.limit, toOrderDTO);
}

export async function get(id: string) {
  const order = await orderRepository.findById(id);
  if (!order) throw new NotFoundError("Pedido não encontrado");
  return toOrderDTO(order);
}

export async function create(input: CreateOrderInput) {
  const order = await orderRepository.create(input);
  return toOrderDTO(order);
}

export async function update(id: string, input: UpdateOrderInput) {
  const existing = await get(id);
  if (existing.status === "RELEASED" || existing.status === "DELIVERED") {
    throw new AppError("Este pedido já está em uma rota de entrega e não pode ser editado", 409);
  }
  const order = await orderRepository.update(id, input);
  return toOrderDTO(order);
}

/** Substitui a exclusão definitiva do antigo "fechar mês": arquiva sem perder o histórico. */
export async function archive(id: string) {
  await get(id);
  const order = await orderRepository.setStatus(id, "ARCHIVED");
  return toOrderDTO(order);
}

export async function unarchive(id: string) {
  await get(id);
  const order = await orderRepository.setStatus(id, "PENDING");
  return toOrderDTO(order);
}
