import { prisma } from "./prismaClient.js";

export function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
}

export function findById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
