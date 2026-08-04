import { prisma } from "./prismaClient.js";
import type { ProductInput } from "../../domain/product.js";

export function findById(id: string) {
  return prisma.product.findUnique({ where: { id } });
}

/** Lista para uso interno (pedidos, catálogo do app): só produtos ativos, sem paginação — o catálogo inteiro é pequeno. */
export function listActive() {
  return prisma.product.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

/** Lista para administração (painel do Dono): inclui inativos, com paginação. */
export function listAll(cursor: string | undefined, limit: number) {
  return prisma.product.findMany({
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { updatedAt: "desc" },
  });
}

export function create(input: ProductInput) {
  return prisma.product.create({
    data: {
      name: input.name,
      category: input.category,
      unitPrice: input.unitPrice,
      sku: input.sku,
      active: input.active ?? true,
    },
  });
}

export function update(id: string, input: ProductInput) {
  return prisma.product.update({
    where: { id },
    data: {
      name: input.name,
      category: input.category,
      unitPrice: input.unitPrice,
      sku: input.sku,
      active: input.active ?? true,
    },
  });
}

/** Soft-delete: mantém o produto para não quebrar pedidos antigos que o referenciam. */
export function deactivate(id: string) {
  return prisma.product.update({ where: { id }, data: { active: false } });
}
