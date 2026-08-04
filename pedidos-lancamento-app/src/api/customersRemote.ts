import { apiRequest } from "./httpClient";
import type { Customer } from "../types";

export type CustomerInput = {
  name: string;
  phone?: string;
  address?: string;
  note?: string;
};

type Page<T> = { items: T[]; nextCursor: string | null };

/**
 * Traz até 200 clientes numa página só — confortável para o volume de uma
 * microempresa. Se a base crescer além disso, o próximo passo é paginar de
 * verdade na tela (a API já suporta `cursor`/`limit`).
 */
export async function remoteListCustomers(): Promise<Customer[]> {
  const page = await apiRequest<Page<Customer>>("/v1/customers?limit=200");
  return page.items;
}

export function remoteCreateCustomer(input: CustomerInput): Promise<Customer> {
  return apiRequest<Customer>("/v1/customers", { method: "POST", body: input });
}

export function remoteUpdateCustomer(id: string, input: CustomerInput): Promise<Customer> {
  return apiRequest<Customer>(`/v1/customers/${id}`, { method: "PATCH", body: input });
}

export function remoteDeleteCustomer(id: string): Promise<void> {
  return apiRequest<void>(`/v1/customers/${id}`, { method: "DELETE" });
}
