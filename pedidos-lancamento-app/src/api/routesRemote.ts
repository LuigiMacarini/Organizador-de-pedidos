import { apiRequest } from "./httpClient";
import type { Delivery, DeliveryRoute } from "../types";

export type CreateRouteInput = {
  orderIds: string[];
  originLat?: number;
  originLng?: number;
  originLabel?: string;
};

type Page<T> = { items: T[]; nextCursor: string | null };

export async function remoteListRoutes(): Promise<DeliveryRoute[]> {
  const page = await apiRequest<Page<DeliveryRoute>>("/v1/routes?limit=100");
  return page.items;
}

export function remoteGetRoute(id: string): Promise<DeliveryRoute> {
  return apiRequest<DeliveryRoute>(`/v1/routes/${id}`);
}

export function remoteCreateRoute(input: CreateRouteInput): Promise<DeliveryRoute> {
  return apiRequest<DeliveryRoute>("/v1/routes", { method: "POST", body: input });
}

export function remoteStartRoute(id: string): Promise<DeliveryRoute> {
  return apiRequest<DeliveryRoute>(`/v1/routes/${id}/start`, { method: "POST" });
}

export function remoteCancelRoute(id: string): Promise<DeliveryRoute> {
  return apiRequest<DeliveryRoute>(`/v1/routes/${id}/cancel`, { method: "POST" });
}

/** Apaga definitivamente rotas já encerradas (COMPLETED/CANCELED). Rotas ativas não são afetadas. */
export function remoteClearRouteHistory(): Promise<{ deleted: number }> {
  return apiRequest<{ deleted: number }>("/v1/routes/clear-history", { method: "POST" });
}

export function remoteUpdateDeliveryStatus(
  id: string,
  status: "DELIVERED" | "FAILED",
  notes?: string
): Promise<Delivery> {
  return apiRequest<Delivery>(`/v1/deliveries/${id}`, { method: "PATCH", body: { status, notes } });
}
