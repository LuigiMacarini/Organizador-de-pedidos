import type { RouteStatus } from "@prisma/client";
import { prisma } from "./prismaClient.js";

const customerSelect = {
  name: true,
  street: true,
  number: true,
  neighborhood: true,
  city: true,
  state: true,
} as const;

const include = {
  deliveries: { include: { customer: { select: customerSelect } } },
} as const;

export function findById(id: string) {
  return prisma.route.findUnique({ where: { id }, include });
}

export function list(cursor: string | undefined, limit: number) {
  return prisma.route.findMany({
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include,
  });
}

export type NewDeliveryInput = {
  orderId: string;
  customerId: string;
  sequence: number;
  destinationLat: number;
  destinationLng: number;
};

export type CreateRouteData = {
  delivererId: string;
  originLabel: string;
  originLat: number;
  originLng: number;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  geometry: string | null;
  deliveries: NewDeliveryInput[];
};

/**
 * Cria a rota + entregas e marca os pedidos correspondentes como `RELEASED`
 * numa única transação — evita que dois entregadores roteirizem o mesmo
 * pedido numa condição de corrida (ver plano, §17).
 */
export function create(data: CreateRouteData) {
  return prisma.$transaction(async (tx) => {
    const route = await tx.route.create({
      data: {
        delivererId: data.delivererId,
        originLabel: data.originLabel,
        originLat: data.originLat,
        originLng: data.originLng,
        totalDistanceMeters: data.totalDistanceMeters,
        totalDurationSeconds: data.totalDurationSeconds,
        geometry: data.geometry,
        deliveries: { create: data.deliveries },
      },
      include,
    });

    await tx.order.updateMany({
      where: { id: { in: data.deliveries.map((d) => d.orderId) } },
      data: { status: "RELEASED" },
    });

    return route;
  });
}

export function setStatus(
  id: string,
  status: RouteStatus,
  extra?: { startedAt?: Date; completedAt?: Date }
) {
  return prisma.route.update({
    where: { id },
    data: { status, ...extra },
    include,
  });
}

/**
 * Remove definitivamente rotas já encerradas (COMPLETED/CANCELED) — usado por
 * "Limpar histórico". As `Delivery`s são apagadas em cascata (`onDelete: Cascade`
 * na relação com `Route`); os `Order`s não são afetados, já com seu próprio
 * status final (DELIVERED/PENDING) independente da rota existir ou não.
 */
export function deleteFinished() {
  return prisma.route.deleteMany({ where: { status: { in: ["COMPLETED", "CANCELED"] } } });
}

/** Devolve os pedidos da rota para `PENDING` — usado ao cancelar uma rota. */
export function releaseOrdersBackToPending(routeId: string) {
  return prisma.$transaction(async (tx) => {
    const deliveries = await tx.delivery.findMany({ where: { routeId }, select: { orderId: true } });
    await tx.order.updateMany({
      where: { id: { in: deliveries.map((d) => d.orderId) } },
      data: { status: "PENDING" },
    });
  });
}
