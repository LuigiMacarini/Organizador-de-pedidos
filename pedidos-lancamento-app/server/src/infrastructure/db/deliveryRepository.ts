import type { DeliveryStatus } from "@prisma/client";
import { prisma } from "./prismaClient.js";

const customerSelect = {
  name: true,
  street: true,
  number: true,
  neighborhood: true,
  city: true,
  state: true,
} as const;

export function findById(id: string) {
  return prisma.delivery.findUnique({
    where: { id },
    include: { customer: { select: customerSelect } },
  });
}

export function updateStatus(id: string, status: DeliveryStatus, notes: string | undefined) {
  return prisma.delivery.update({
    where: { id },
    data: {
      status,
      notes: notes ?? "",
      deliveredAt: status === "DELIVERED" ? new Date() : null,
    },
    include: { customer: { select: customerSelect } },
  });
}

/** Quantas entregas da rota ainda estão pendentes — usado para saber se a rota terminou. */
export function countPending(routeId: string) {
  return prisma.delivery.count({ where: { routeId, status: "PENDING" } });
}
