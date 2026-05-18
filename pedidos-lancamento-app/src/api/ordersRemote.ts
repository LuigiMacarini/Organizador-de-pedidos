import type { LineItem, Order } from "../types";

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

async function readError(res: Response): Promise<string> {
  try {
    const t = await res.text();
    if (!t) return res.statusText;
    try {
      const j = JSON.parse(t) as { error?: string };
      return j.error ?? t;
    } catch {
      return t;
    }
  } catch {
    return res.statusText;
  }
}

export async function remoteListOrders(baseUrl: string): Promise<Order[]> {
  const res = await fetch(joinUrl(baseUrl, "/v1/orders"));
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as Order[];
}

export async function remoteCreateOrder(
  baseUrl: string,
  input: Omit<Order, "id" | "createdAt" | "updatedAt">
): Promise<Order> {
  const res = await fetch(joinUrl(baseUrl, "/v1/orders"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: input.customerName,
      notes: input.notes ?? "",
      items: input.items as LineItem[],
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as Order;
}

export async function remoteUpdateOrder(baseUrl: string, order: Order): Promise<Order> {
  const res = await fetch(joinUrl(baseUrl, `/v1/orders/${order.id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: order.customerName,
      notes: order.notes,
      items: order.items,
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as Order;
}

export async function remoteDeleteOrder(baseUrl: string, id: string): Promise<void> {
  const res = await fetch(joinUrl(baseUrl, `/v1/orders/${id}`), {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) throw new Error(await readError(res));
}
