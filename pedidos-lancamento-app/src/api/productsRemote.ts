import { apiRequest } from "./httpClient";
import type { Product } from "../types";

/** Catálogo ativo, para montar pedidos — lista única, sem paginação (poucas dezenas de itens). */
export function remoteListProducts(): Promise<Product[]> {
  return apiRequest<Product[]>("/v1/products");
}
