import * as customerRepository from "../../infrastructure/db/customerRepository.js";
import { geocodeCustomer } from "../geocoding/geocodingService.js";
import { NotFoundError } from "../../domain/errors.js";
import { ADDRESS_FIELDS, toCustomerDTO, type CustomerInput } from "../../domain/customer.js";
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
  await geocodeCustomer(customer.id);
  return get(customer.id);
}

export async function update(id: string, input: CustomerInput) {
  const existing = await get(id);
  const customer = await customerRepository.update(id, input);
  const addressChanged = ADDRESS_FIELDS.some((field) => (existing[field] ?? "") !== (input[field] ?? ""));
  if (addressChanged) {
    await geocodeCustomer(customer.id);
    return get(customer.id);
  }
  return toCustomerDTO(customer);
}

export async function remove(id: string) {
  await get(id);
  await customerRepository.remove(id);
}

/** Força uma nova tentativa de geocodificação (reprocessamento manual). */
export async function regeocode(id: string) {
  await get(id);
  await geocodeCustomer(id);
  return get(id);
}
