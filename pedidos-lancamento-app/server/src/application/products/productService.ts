import * as productRepository from "../../infrastructure/db/productRepository.js";
import { NotFoundError } from "../../domain/errors.js";
import { toProductDTO, type ProductInput } from "../../domain/product.js";
import { toPage, type PaginationQuery } from "../../domain/pagination.js";

/** Catálogo consumido pelo formulário de pedido: só ativos, sem paginação. */
export async function listActive() {
  const rows = await productRepository.listActive();
  return rows.map(toProductDTO);
}

/** Lista administrável (painel do Dono), com paginação e produtos inativos incluídos. */
export async function listAll(query: PaginationQuery) {
  const rows = await productRepository.listAll(query.cursor, query.limit);
  return toPage(rows, query.limit, toProductDTO);
}

export async function get(id: string) {
  const product = await productRepository.findById(id);
  if (!product) throw new NotFoundError("Produto não encontrado");
  return toProductDTO(product);
}

export async function create(input: ProductInput) {
  const product = await productRepository.create(input);
  return toProductDTO(product);
}

export async function update(id: string, input: ProductInput) {
  await get(id);
  const product = await productRepository.update(id, input);
  return toProductDTO(product);
}

export async function deactivate(id: string) {
  await get(id);
  const product = await productRepository.deactivate(id);
  return toProductDTO(product);
}
