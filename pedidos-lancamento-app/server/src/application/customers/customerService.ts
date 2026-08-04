import * as customerRepository from "../../infrastructure/db/customerRepository.js";
import { NotFoundError } from "../../domain/errors.js";
import { toCustomerDTO, type CustomerInput } from "../../domain/customer.js";
import { toPage, type PaginationQuery } from "../../domain/pagination.js";

export async function list(query: PaginationQuery) {
  const rows = await customerRepository.list(query.cursor, query.limit);
  return toPage(rows, query.limit, toCustomerDTO);
}

export async function get(id: string) {
  const customer = await customerRepository.findById(id);
  if (!customer) throw new NotFoundError("Cliente não encontrado");
  return toCustomerDTO(customer);
}

export async function create(input: CustomerInput) {
  const customer = await customerRepository.create(input);
  return toCustomerDTO(customer);
}

export async function update(id: string, input: CustomerInput) {
  await get(id);
  const customer = await customerRepository.update(id, input);
  return toCustomerDTO(customer);
}

export async function remove(id: string) {
  await get(id);
  await customerRepository.remove(id);
}
