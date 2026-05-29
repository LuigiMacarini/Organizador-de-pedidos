import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Customer } from "./types";

const KEY = "@pedidos:clientes:v1";

function sortCustomers(customers: Customer[]): Customer[] {
  return [...customers].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
  );
}

export async function loadCustomers(): Promise<Customer[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Customer[];
    return Array.isArray(parsed) ? sortCustomers(parsed) : [];
  } catch {
    return [];
  }
}

export async function saveCustomers(customers: Customer[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(sortCustomers(customers)));
}
