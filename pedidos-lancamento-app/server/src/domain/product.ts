import { z } from "zod";
import type { Product } from "@prisma/client";

export const productInputSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  category: z.string().trim().min(1, "Categoria é obrigatória"),
  unitPrice: z.number().positive("Preço deve ser maior que zero"),
  sku: z.string().trim().optional(),
  active: z.boolean().optional().default(true),
});

export type ProductInput = z.infer<typeof productInputSchema>;

export type ProductDTO = {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  sku: string | null;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

export function toProductDTO(product: Product): ProductDTO {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    unitPrice: product.unitPrice,
    sku: product.sku,
    active: product.active,
    createdAt: product.createdAt.getTime(),
    updatedAt: product.updatedAt.getTime(),
  };
}
