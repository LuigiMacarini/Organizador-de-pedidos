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
      note: input.note ?? "",
      street: input.street,
      number: input.number,
      neighborhood: input.neighborhood,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
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
      note: input.note ?? "",
      street: input.street,
      number: input.number,
      neighborhood: input.neighborhood,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
    },
    include: withOrderCount,
  });
}

export type GeocodeResultUpdate =
  | { status: "OK"; latitude: number; longitude: number }
  | { status: "PARTIAL"; latitude: number; longitude: number }
  | { status: "FAILED" };

/** Grava o resultado de uma tentativa de geocodificação. Nunca lança — chamado de um contexto best-effort. */
export function setGeocodeResult(id: string, result: GeocodeResultUpdate) {
  return prisma.customer.update({
    where: { id },
    data: {
      geocodeStatus: result.status,
      latitude: result.status === "FAILED" ? null : result.latitude,
      longitude: result.status === "FAILED" ? null : result.longitude,
      geocodedAt: new Date(),
    },
  });
}

export async function remove(id: string) {
  try {
    await prisma.customer.delete({ where: { id } });
  } catch (e) {
    // P2003 é o código que o Prisma normalmente usa pra violação de chave
    // estrangeira — mas a constraint de `Order.customerId` é RESTRICT
    // (nunca CASCADE, de propósito: apagar cliente não pode levar pedidos
    // junto), e pra esse tipo específico o Postgres manda o SQLSTATE 23001
    // ("restrict_violation"), que o Prisma não reconhece como erro
    // "conhecido" — vira `PrismaClientUnknownRequestError` genérico e cai
    // fora do `instanceof` de cima, virando 500 cru em vez da mensagem
    // amigável (confirmado em produção). Cobre os dois casos.
    const isForeignKeyViolation =
      (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") ||
      (e instanceof Prisma.PrismaClientUnknownRequestError && /23001|23503/.test(e.message));
    if (isForeignKeyViolation) {
      throw new AppError(
        "Este cliente tem pedidos no histórico e não pode ser excluído",
        409
      );
    }
    throw e;
  }
}
