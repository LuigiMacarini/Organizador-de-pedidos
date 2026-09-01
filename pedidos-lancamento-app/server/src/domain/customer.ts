import { z } from "zod";
import type { Customer, GeocodeStatus } from "@prisma/client";

/** Normaliza um nome para deduplicação (trim + lowercase). */
export function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export const customerInputSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  phone: z.string().trim().optional().default(""),
  note: z.string().trim().optional().default(""),
  street: z.string().trim().optional(),
  number: z.string().trim().optional(),
  neighborhood: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zipCode: z.string().trim().optional(),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;

/** Campos de endereço que, ao mudar, exigem nova geocodificação. Ver `geocodingService`. */
export const ADDRESS_FIELDS = [
  "street",
  "number",
  "neighborhood",
  "city",
  "state",
  "zipCode",
] as const;

export type CustomerDTO = {
  id: string;
  name: string;
  phone: string;
  note: string;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodeStatus: GeocodeStatus;
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
    note: customer.note,
    street: customer.street,
    number: customer.number,
    neighborhood: customer.neighborhood,
    city: customer.city,
    state: customer.state,
    zipCode: customer.zipCode,
    latitude: customer.latitude,
    longitude: customer.longitude,
    geocodeStatus: customer.geocodeStatus,
    orderCount: customer._count?.orders,
    createdAt: customer.createdAt.getTime(),
    updatedAt: customer.updatedAt.getTime(),
  };
}
