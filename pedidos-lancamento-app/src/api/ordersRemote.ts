import { apiRequest } from "./httpClient";
import type { Order } from "../types";

export type OrderLineInput = { productId: string; qty: number };

export type CreateOrderInput = {
  customerId: string;
  items: OrderLineInput[];
  notes?: string;
};

export type UpdateOrderInput = Partial<CreateOrderInput>;

type Page<T> = { items: T[]; nextCursor: string | null };

/** Ver nota em `customersRemote.ts` sobre o limite de página único. */
export async function remoteListOrders(
  status: "pending" | "archived" | "all" | "deliverable" = "pending"
): Promise<Order[]> {
  const page = await apiRequest<Page<Order>>(`/v1/orders?status=${status}&limit=200`);
  return page.items;
}

export function remoteGetOrder(id: string): Promise<Order> {
  return apiRequest<Order>(`/v1/orders/${id}`);
}

export function remoteCreateOrder(input: CreateOrderInput): Promise<Order> {
  return apiRequest<Order>("/v1/orders", { method: "POST", body: input });
}

export function remoteUpdateOrder(id: string, input: UpdateOrderInput): Promise<Order> {
  return apiRequest<Order>(`/v1/orders/${id}`, { method: "PATCH", body: input });
}

export function remoteArchiveOrder(id: string): Promise<Order> {
  return apiRequest<Order>(`/v1/orders/${id}/archive`, { method: "POST" });
}

export function remoteUnarchiveOrder(id: string): Promise<Order> {
  return apiRequest<Order>(`/v1/orders/${id}/unarchive`, { method: "POST" });
}
