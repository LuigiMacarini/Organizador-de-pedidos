import { PrismaClient } from "@prisma/client";

const basePrisma = new PrismaClient();

/**
 * O Postgres do Render (free tier) fecha conexões ociosas depois de um
 * tempo parado — a primeira query após um período de inatividade às vezes
 * cai numa conexão do pool que o Prisma ainda não percebeu que está morta,
 * e falha com `PrismaClientInitializationError: Server has closed the
 * connection`. Não é o servidor Node "acordando" (esse já respondeu antes
 * de chegar aqui) — é só essa reconexão pontual com o banco.
 */
function isStaleConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "PrismaClientInitializationError") return true;
  return /server has closed the connection|connection terminated|econnreset/i.test(error.message);
}

/** Uma única tentativa extra por operação quando a conexão está obsoleta — nunca mascara um bug de verdade. */
export const prisma = basePrisma.$extends({
  query: {
    async $allOperations({ model, operation, args, query }) {
      try {
        return await query(args);
      } catch (error) {
        if (!isStaleConnectionError(error)) throw error;
        console.warn(
          `[DB] conexão com o Postgres estava obsoleta, tentando de novo (${model ?? "?"}.${operation})`
        );
        return await query(args);
      }
    },
  },
});
