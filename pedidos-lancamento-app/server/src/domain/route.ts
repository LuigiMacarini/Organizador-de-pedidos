import { z } from "zod";
import type { Route, Delivery, RouteStatus, DeliveryStatus, Customer } from "@prisma/client";
import { paginationQuerySchema } from "./pagination.js";

/**
 * `originLat`/`originLng`/`originLabel` são opcionais: quando ausentes, o
 * service usa a origem fixa da empresa (variáveis de ambiente
 * `COMPANY_ORIGIN_*`). Ver `routeService.resolveOrigin`.
 */
export const createRouteInputSchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um pedido"),
  originLat: z.number().optional(),
  originLng: z.number().optional(),
  originLabel: z.string().trim().optional(),
});

export type CreateRouteInput = z.infer<typeof createRouteInputSchema>;

export const updateDeliveryStatusInputSchema = z.object({
  status: z.enum(["DELIVERED", "FAILED"]),
  notes: z.string().trim().optional(),
});

export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusInputSchema>;

export const routeListQuerySchema = paginationQuerySchema;

export type DeliveryDTO = {
  id: string;
  routeId: string;
  orderId: string;
  customerId: string;
  customerName: string;
  /** Endereço formatado do cliente (rua/número - bairro, cidade, UF), para o entregador saber onde ir. */
  address: string;
  sequence: number;
  destinationLat: number;
  destinationLng: number;
  status: DeliveryStatus;
  deliveredAt: number | null;
  notes: string;
};

type DeliveryCustomer = Pick<Customer, "name" | "street" | "number" | "neighborhood" | "city" | "state">;

function formatAddress(customer: DeliveryCustomer): string {
  const line1 = [customer.street, customer.number].filter(Boolean).join(", ");
  const line2 = [customer.neighborhood, customer.city, customer.state].filter(Boolean).join(", ");
  return [line1, line2].filter(Boolean).join(" — ");
}

export type RouteDTO = {
  id: string;
  delivererId: string;
  status: RouteStatus;
  originLabel: string;
  originLat: number;
  originLng: number;
  totalDistanceMeters: number | null;
  totalDurationSeconds: number | null;
  /** Polyline codificada do trajeto real (padrão Google/OSRM) — `null` se a otimização falhou (modo degradado, ver §13). */
  geometry: string | null;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  deliveries: DeliveryDTO[];
};

export function toDeliveryDTO(delivery: Delivery & { customer: DeliveryCustomer }): DeliveryDTO {
  return {
    id: delivery.id,
    routeId: delivery.routeId,
    orderId: delivery.orderId,
    customerId: delivery.customerId,
    customerName: delivery.customer.name,
    address: formatAddress(delivery.customer),
    sequence: delivery.sequence,
    destinationLat: delivery.destinationLat,
    destinationLng: delivery.destinationLng,
    status: delivery.status,
    deliveredAt: delivery.deliveredAt?.getTime() ?? null,
    notes: delivery.notes,
  };
}

export function toRouteDTO(
  route: Route & { deliveries: (Delivery & { customer: DeliveryCustomer })[] }
): RouteDTO {
  return {
    id: route.id,
    delivererId: route.delivererId,
    status: route.status,
    originLabel: route.originLabel,
    originLat: route.originLat,
    originLng: route.originLng,
    totalDistanceMeters: route.totalDistanceMeters,
    totalDurationSeconds: route.totalDurationSeconds,
    geometry: route.geometry,
    createdAt: route.createdAt.getTime(),
    updatedAt: route.updatedAt.getTime(),
    startedAt: route.startedAt?.getTime() ?? null,
    completedAt: route.completedAt?.getTime() ?? null,
    deliveries: route.deliveries
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map(toDeliveryDTO),
  };
}
