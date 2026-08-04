import { z } from "zod";
import type { Customer } from "@prisma/client";

/** Normaliza um nome para deduplicação (trim + lowercase). */
export function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export const customerInputSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  phone: z.string().trim().optional().default(""),
  address: z.string().trim().optional(),
  note: z.string().trim().optional().default(""),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;

export type CustomerDTO = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  note: string;
  orderCount?: number;
  createdAt: number;
  updatedAt: number;
};

export function toCustomerDTO(
  customer: Customer & { _count?: { orders: number } }
): CustomerDTO {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    note: customer.note,
    orderCount: customer._count?.orders,
    createdAt: customer.createdAt.getTime(),
    updatedAt: customer.updatedAt.getTime(),
  };
}
