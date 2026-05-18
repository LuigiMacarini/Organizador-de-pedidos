import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Order } from "./types";

const KEY = "@pedidos:lancamentos:v1";

function sortOrders(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadOrders(): Promise<Order[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Order[];
    return Array.isArray(parsed) ? sortOrders(parsed) : [];
  } catch {
    return [];
  }
}

export async function saveOrders(orders: Order[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(sortOrders(orders)));
}

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
