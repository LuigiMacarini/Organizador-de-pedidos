import { z } from "zod";
import type { Order, OrderLine, OrderStatus, Customer } from "@prisma/client";
import { paginationQuerySchema } from "./pagination.js";

/**
 * O cliente manda só `productId` + `qty` — nome e preço são resolvidos a
 * partir do `Product` no servidor (nunca confiar em preço vindo do app).
 */
export const lineItemInputSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().positive().max(1_000_000),
});

export const createOrderInputSchema = z.object({
  customerId: z.string().min(1),
  items: z.array(lineItemInputSchema).min(1, "Adicione ao menos um produto"),
  notes: z.string().trim().optional().default(""),
});

export const updateOrderInputSchema = z.object({
  customerId: z.string().min(1).optional(),
  items: z.array(lineItemInputSchema).min(1).optional(),
  notes: z.string().trim().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderInputSchema>;

/** Estados que o painel do Dono usa hoje. Os demais (fluxo de Remessa/Entrega) ficam reservados. */
export const ACTIVE_STATUSES: OrderStatus[] = ["PENDING"];
export const ARCHIVED_STATUSES: OrderStatus[] = ["ARCHIVED"];
const ALL_STATUSES: OrderStatus[] = [
  "PENDING",
  "ARCHIVED",
  "RELEASED",
  "DELIVERED",
  "CANCELED",
];

export const orderStatusFilterSchema = z
  .enum(["pending", "archived", "all"])
  .optional()
  .default("pending");

export type OrderStatusFilter = z.infer<typeof orderStatusFilterSchema>;

export const orderListQuerySchema = paginationQuerySchema.extend({
  status: orderStatusFilterSchema,
});

export function resolveStatusFilter(filter: OrderStatusFilter): OrderStatus[] {
  if (filter === "archived") return ARCHIVED_STATUSES;
  if (filter === "all") return ALL_STATUSES;
  return ACTIVE_STATUSES;
}

export type OrderLineDTO = {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
};

export type OrderDTO = {
  id: string;
  customerId: string;
  customerName: string;
  notes: string;
  status: OrderStatus;
  items: OrderLineDTO[];
  createdAt: number;
  updatedAt: number;
};

export function getOrderTotal(items: Pick<OrderLineDTO, "unitPrice" | "qty">[]): number {
  return items.reduce((acc, l) => acc + l.unitPrice * l.qty, 0);
}

export function toOrderDTO(
  order: Order & { customer: Pick<Customer, "name">; lines: OrderLine[] }
): OrderDTO {
  return {
    id: order.id,
    customerId: order.customerId,
    customerName: order.customer.name,
    notes: order.notes,
    status: order.status,
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
