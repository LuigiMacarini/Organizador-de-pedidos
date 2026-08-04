import { Prisma } from "@prisma/client";
import { prisma } from "./prismaClient.js";
import { AppError } from "../../domain/errors.js";
import type { CustomerInput } from "../../domain/customer.js";
import { normalizeNameKey } from "../../domain/customer.js";

const withOrderCount = { _count: { select: { orders: true } } } as const;

export function findById(id: string) {
  return prisma.customer.findUnique({ where: { id }, include: withOrderCount });
}

export function findByNameKey(nameKey: string) {
  return prisma.customer.findUnique({ where: { nameKey } });
}

export async function list(cursor: string | undefined, limit: number) {
  return prisma.customer.findMany({
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { updatedAt: "desc" },
    include: withOrderCount,
  });
}

export async function create(input: CustomerInput) {
  const nameKey = normalizeNameKey(input.name);
  const existing = await findByNameKey(nameKey);
  if (existing) throw new AppError("Já existe um cliente com esse nome", 409);
  return prisma.customer.create({
    data: {
      name: input.name,
      nameKey,
      phone: input.phone ?? "",
      address: input.address,
      note: input.note ?? "",
    },
    include: withOrderCount,
  });
}

export async function update(id: string, input: CustomerInput) {
  const nameKey = normalizeNameKey(input.name);
  const existing = await findByNameKey(nameKey);
  if (existing && existing.id !== id) {
    throw new AppError("Já existe um cliente com esse nome", 409);
  }
  return prisma.customer.update({
    where: { id },
    data: {
      name: input.name,
      nameKey,
      phone: input.phone ?? "",
      address: input.address,
      note: input.note ?? "",
    },
    include: withOrderCount,
  });
}

export async function remove(id: string) {
  try {
    await prisma.customer.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      throw new AppError(
        "Este cliente tem pedidos no histórico e não pode ser excluído",
        409
      );
    }
    throw e;
  }
}
