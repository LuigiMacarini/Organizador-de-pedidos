import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "./prismaClient.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import type { CreateOrderInput, UpdateOrderInput } from "../../domain/order.js";

const include = { customer: true, lines: true } satisfies Prisma.OrderInclude;

/** Resolve `{ productId, qty }` para linhas com nome/preço tirados do catálogo atual (nunca do cliente). */
async function resolveLines(items: { productId: string; qty: number }[]) {
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return items.map((item) => {
    const product = byId.get(item.productId);
    if (!product || !product.active) {
      throw new AppError(`Produto ${item.productId} indisponível`, 400);
    }
    return {
      productId: product.id,
      name: product.name,
      unitPrice: product.unitPrice,
      qty: item.qty,
    };
  });
}

export function findById(id: string) {
  return prisma.order.findUnique({ where: { id }, include });
}

export function findManyByIds(ids: string[]) {
  return prisma.order.findMany({ where: { id: { in: ids } }, include });
}

export function list(opts: {
  cursor: string | undefined;
  limit: number;
  statuses: OrderStatus[];
  /** Só pedidos com cliente geocodificado e sem entrega ativa — usado pela roteirização. */
  deliverableOnly?: boolean;
}) {
  return prisma.order.findMany({
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    where: {
      status: { in: opts.statuses },
      ...(opts.deliverableOnly
        ? { customer: { geocodeStatus: "OK" }, deliveries: { none: { status: "PENDING" } } }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include,
  });
}

export async function create(input: CreateOrderInput) {
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new NotFoundError("Cliente não encontrado");
  const lines = await resolveLines(input.items);
  return prisma.order.create({
    data: {
      customerId: customer.id,
      notes: input.notes ?? "",
      lines: { create: lines },
    },
    include,
  });
}

export async function update(id: string, input: UpdateOrderInput) {
  const existing = await findById(id);
  if (!existing) throw new NotFoundError("Pedido não encontrado");

  const data: Prisma.OrderUpdateInput = {};
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.customerId !== undefined) {
    const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new NotFoundError("Cliente não encontrado");
    data.customer = { connect: { id: customer.id } };
  }

  if (input.items !== undefined) {
    const lines = await resolveLines(input.items);
    return prisma.$transaction(async (tx) => {
      await tx.orderLine.deleteMany({ where: { orderId: id } });
      return tx.order.update({
        where: { id },
        data: { ...data, lines: { create: lines } },
        include,
      });
    });
  }

  return prisma.order.update({ where: { id }, data, include });
}

export function setStatus(id: string, status: OrderStatus) {
  return prisma.order.update({ where: { id }, data: { status }, include });
}
