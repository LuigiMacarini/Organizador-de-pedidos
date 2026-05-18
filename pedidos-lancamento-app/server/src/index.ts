import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PORT = Number(process.env.PORT) || 3333;

export type LineItemDto = {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
};

export type OrderDto = {
  id: string;
  customerName: string;
  notes: string;
  items: LineItemDto[];
  createdAt: number;
  updatedAt: number;
};

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

async function findOrCreateCustomer(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    const err = new Error("Nome do cliente é obrigatório");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  const nameKey = normalizeNameKey(trimmed);
  const existing = await prisma.customer.findUnique({ where: { nameKey } });
  if (existing) {
    if (existing.name !== trimmed) {
      return prisma.customer.update({
        where: { id: existing.id },
        data: { name: trimmed },
      });
    }
    return existing;
  }
  return prisma.customer.create({
    data: { name: trimmed, nameKey },
  });
}

function mapOrder(order: {
  id: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  customer: { name: string };
  lines: { productId: string; name: string; unitPrice: number; qty: number }[];
}): OrderDto {
  return {
    id: order.id,
    customerName: order.customer.name,
    notes: order.notes,
    items: order.lines.map((l) => ({
      productId: l.productId,
      name: l.name,
      unitPrice: l.unitPrice,
      qty: l.qty,
    })),
    createdAt: order.createdAt.getTime(),
    updatedAt: order.updatedAt.getTime(),
  };
}

function validateItems(items: unknown): asserts items is LineItemDto[] {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error("items deve ser um array não vazio");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  for (const it of items) {
    if (
      typeof it !== "object" ||
      it === null ||
      typeof (it as LineItemDto).productId !== "string" ||
      typeof (it as LineItemDto).name !== "string" ||
      typeof (it as LineItemDto).unitPrice !== "number" ||
      typeof (it as LineItemDto).qty !== "number"
    ) {
      const err = new Error("Item de pedido inválido");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    if ((it as LineItemDto).qty < 1) {
      const err = new Error("Quantidade mínima por item é 1");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
  }
}

async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });

  app.get("/health", async () => ({ ok: true }));

  app.get("/v1/customers", async () => {
    const rows = await prisma.customer.findMany({
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { orders: true } } },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      orderCount: c._count.orders,
      createdAt: c.createdAt.getTime(),
      updatedAt: c.updatedAt.getTime(),
    }));
  });

  app.post<{ Body: { name?: string } }>("/v1/customers", async (req, reply) => {
    const name = req.body?.name;
    if (typeof name !== "string") {
      return reply.status(400).send({ error: "name é obrigatório" });
    }
    try {
      const customer = await findOrCreateCustomer(name);
      return reply.status(201).send({
        id: customer.id,
        name: customer.name,
        createdAt: customer.createdAt.getTime(),
        updatedAt: customer.updatedAt.getTime(),
      });
    } catch (e) {
      const status = (e as Error & { statusCode?: number }).statusCode ?? 500;
      return reply.status(status).send({ error: (e as Error).message });
    }
  });

  app.get("/v1/orders", async () => {
    const orders = await prisma.order.findMany({
      orderBy: { updatedAt: "desc" },
      include: { customer: true, lines: true },
    });
    return orders.map(mapOrder);
  });

  app.get<{ Params: { id: string } }>("/v1/orders/:id", async (req, reply) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { customer: true, lines: true },
    });
    if (!order) return reply.status(404).send({ error: "Pedido não encontrado" });
    return mapOrder(order);
  });

  app.post<{
    Body: { customerName?: string; items?: unknown; notes?: string };
  }>("/v1/orders", async (req, reply) => {
    const customerName = req.body?.customerName;
    const items = req.body?.items;
    const notes = typeof req.body?.notes === "string" ? req.body.notes : "";
    if (typeof customerName !== "string") {
      return reply.status(400).send({ error: "customerName é obrigatório" });
    }
    try {
      validateItems(items);
      const customer = await findOrCreateCustomer(customerName);
      const order = await prisma.order.create({
        data: {
          customerId: customer.id,
          notes,
          lines: {
            create: items.map((it) => ({
              productId: it.productId,
              name: it.name,
              unitPrice: it.unitPrice,
              qty: Math.floor(it.qty),
            })),
          },
        },
        include: { customer: true, lines: true },
      });
      return reply.status(201).send(mapOrder(order));
    } catch (e) {
      const status = (e as Error & { statusCode?: number }).statusCode ?? 500;
      return reply.status(status).send({ error: (e as Error).message });
    }
  });

  app.patch<{
    Params: { id: string };
    Body: { customerName?: string; items?: unknown; notes?: string };
  }>("/v1/orders/:id", async (req, reply) => {
    const id = req.params.id;
    const existing = await prisma.order.findUnique({
      where: { id },
      include: { customer: true, lines: true },
    });
    if (!existing) return reply.status(404).send({ error: "Pedido não encontrado" });

    const nextNotes =
      typeof req.body?.notes === "string" ? req.body.notes : existing.notes;
    const nextCustomerName =
      typeof req.body?.customerName === "string"
        ? req.body.customerName
        : existing.customer.name;
    const itemsBody = req.body?.items;

    try {
      const customer = await findOrCreateCustomer(nextCustomerName);

      if (itemsBody !== undefined) {
        validateItems(itemsBody);
        await prisma.$transaction(async (tx) => {
          await tx.orderLine.deleteMany({ where: { orderId: id } });
          await tx.order.update({
            where: { id },
            data: {
              customerId: customer.id,
              notes: nextNotes,
              lines: {
                create: itemsBody.map((it) => ({
                  productId: it.productId,
                  name: it.name,
                  unitPrice: it.unitPrice,
                  qty: Math.floor(it.qty),
                })),
              },
            },
          });
        });
      } else {
        await prisma.order.update({
          where: { id },
          data: { customerId: customer.id, notes: nextNotes },
        });
      }

      const updated = await prisma.order.findUniqueOrThrow({
        where: { id },
        include: { customer: true, lines: true },
      });
      return mapOrder(updated);
    } catch (e) {
      const status = (e as Error & { statusCode?: number }).statusCode ?? 500;
      return reply.status(status).send({ error: (e as Error).message });
    }
  });

  app.delete<{ Params: { id: string } }>("/v1/orders/:id", async (req, reply) => {
    try {
      await prisma.order.delete({ where: { id: req.params.id } });
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: "Pedido não encontrado" });
    }
  });

  return app;
}

async function main() {
  const app = await buildServer();
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
