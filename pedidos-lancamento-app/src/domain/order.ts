import type { LineItem, Order } from "../types";

export function getOrderTotal(items: Pick<LineItem, "unitPrice" | "qty">[]): number {
  return items.reduce((acc, l) => acc + l.unitPrice * l.qty, 0);
}

export function getOrderUnits(items: Pick<LineItem, "qty">[]): number {
  return items.reduce((acc, l) => acc + l.qty, 0);
}

export function groupKey(order: Pick<Order, "customerId" | "customerName">): string {
  return order.customerId || `name:${order.customerName.trim().toLowerCase()}`;
}

/** A API só aceita `{ productId, qty }` — preço/nome vêm sempre do catálogo no servidor. */
export function toOrderLineInputs(items: LineItem[]): { productId: string; qty: number }[] {
  return items.map((l) => ({ productId: l.productId, qty: l.qty }));
}
