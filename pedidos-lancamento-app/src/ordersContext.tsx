import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  remoteArchiveOrder,
  remoteCreateOrder,
  remoteListOrders,
  remoteUnarchiveOrder,
  remoteUpdateOrder,
  type CreateOrderInput,
  type UpdateOrderInput,
} from "./api/ordersRemote";
import type { Order } from "./types";

type OrdersContextValue = {
  orders: Order[];
  loading: boolean;
  refresh: () => Promise<void>;
  createOrder: (input: CreateOrderInput) => Promise<Order>;
  updateOrder: (id: string, input: UpdateOrderInput) => Promise<void>;
  /** Substitui a exclusão definitiva: arquiva mantendo o pedido no histórico. */
  archiveOrder: (id: string) => Promise<void>;
  unarchiveOrder: (id: string) => Promise<void>;
};

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await remoteListOrders("pending"));
    } catch (e) {
      console.error(e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createOrder = useCallback(async (input: CreateOrderInput) => {
    const created = await remoteCreateOrder(input);
    setOrders((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateOrder = useCallback(async (id: string, input: UpdateOrderInput) => {
    const updated = await remoteUpdateOrder(id, input);
    setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
  }, []);

  const archiveOrder = useCallback(async (id: string) => {
    await remoteArchiveOrder(id);
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const unarchiveOrder = useCallback(async (id: string) => {
    await remoteUnarchiveOrder(id);
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ orders, loading, refresh, createOrder, updateOrder, archiveOrder, unarchiveOrder }),
    [orders, loading, refresh, createOrder, updateOrder, archiveOrder, unarchiveOrder]
  );

  return (
    <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}
