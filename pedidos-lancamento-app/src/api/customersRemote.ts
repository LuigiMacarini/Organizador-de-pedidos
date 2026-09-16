import { apiRequest } from "./httpClient";
import type { Customer } from "../types";

export type CustomerInput = {
  name: string;
  phone?: string;
  note?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  /** Só presente quando o endereço veio do Places Autocomplete (já geocodificado). */
  latitude?: number;
  longitude?: number;
};

type Page<T> = { items: T[]; nextCursor: string | null };

// Página única de até 200 clientes, suficiente pro volume atual; a API já suporta paginar de verdade via cursor.
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
