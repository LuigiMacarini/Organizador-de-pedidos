import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  remoteCreateOrder,
  remoteDeleteOrder,
  remoteListOrders,
  remoteUpdateOrder,
} from "./api/ordersRemote";
import { getApiBaseUrl } from "./config";
import type { Order } from "./types";
import { loadOrders, makeId, saveOrders } from "./storage";

type OrdersContextValue = {
  orders: Order[];
  loading: boolean;
  /** `true` quando `EXPO_PUBLIC_API_URL` aponta para a API */
  useRemote: boolean;
  refresh: () => Promise<void>;
  createOrder: (input: Omit<Order, "id" | "createdAt" | "updatedAt">) => Promise<Order>;
  updateOrder: (order: Order) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
};

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const base = getApiBaseUrl();
      if (base) {
        setOrders(await remoteListOrders(base));
      } else {
        setOrders(await loadOrders());
      }
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

  const createOrder = useCallback(
    async (input: Omit<Order, "id" | "createdAt" | "updatedAt">) => {
      const base = getApiBaseUrl();
      if (base) {
        const remote = await remoteCreateOrder(base, input);
        // O servidor atual não persiste `customerId`; mantemos o vínculo
        // escolhido em memória para o agrupamento funcionar na sessão.
        const created = { ...remote, customerId: input.customerId ?? remote.customerId };
        setOrders((prev) => [created, ...prev.filter((o) => o.id !== created.id)]);
        return created;
      }
      const now = Date.now();
      const order: Order = {
        ...input,
        id: makeId(),
        createdAt: now,
        updatedAt: now,
      };
      setOrders((prev) => {
        const next = [order, ...prev];
        void saveOrders(next);
        return next;
      });
      return order;
    },
    []
  );

  const updateOrder = useCallback(async (order: Order) => {
    const base = getApiBaseUrl();
    if (base) {
      const remote = await remoteUpdateOrder(base, order);
      const updated = { ...remote, customerId: order.customerId ?? remote.customerId };
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      return;
    }
    const updated = { ...order, updatedAt: Date.now() };
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === updated.id ? updated : o));
      void saveOrders(next);
      return next;
    });
  }, []);

  const deleteOrder = useCallback(async (id: string) => {
    const base = getApiBaseUrl();
    if (base) {
      await remoteDeleteOrder(base, id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      return;
    }
    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== id);
      void saveOrders(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      orders,
      loading,
      useRemote: !!getApiBaseUrl(),
      refresh,
      createOrder,
      updateOrder,
      deleteOrder,
    }),
    [orders, loading, refresh, createOrder, updateOrder, deleteOrder]
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
