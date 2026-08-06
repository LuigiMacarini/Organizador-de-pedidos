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
import { useAuth } from "./auth/authContext";
import { useAutoRefresh } from "./hooks/useAutoRefresh";
import type { Order } from "./types";

type RefreshOptions = { silent?: boolean };

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
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (opts?: RefreshOptions) => {
    if (!opts?.silent) setLoading(true);
    try {
      setOrders(await remoteListOrders("pending"));
    } catch (e) {
      console.error(e);
      // Mantém a lista atual em erros pontuais — ver mesma decisão em customersContext.
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void refresh();
  }, [user, refresh]);

  // MVP de sincronização entre dispositivos via polling — ver customersContext.
  useAutoRefresh(() => {
    if (user) void refresh({ silent: true });
  });

  const createOrder = useCallback(
    async (input: CreateOrderInput) => {
      const created = await remoteCreateOrder(input);
      setOrders((prev) => [created, ...prev]);
      void refresh({ silent: true });
      return created;
    },
    [refresh]
  );

  const updateOrder = useCallback(
    async (id: string, input: UpdateOrderInput) => {
      const updated = await remoteUpdateOrder(id, input);
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
      void refresh({ silent: true });
    },
    [refresh]
  );

  const archiveOrder = useCallback(
    async (id: string) => {
      await remoteArchiveOrder(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      void refresh({ silent: true });
    },
    [refresh]
  );

  const unarchiveOrder = useCallback(
    async (id: string) => {
      const restored = await remoteUnarchiveOrder(id);
      setOrders((prev) => [restored, ...prev.filter((o) => o.id !== id)]);
      void refresh({ silent: true });
    },
    [refresh]
  );

  const value = useMemo(
    () => ({
      orders,
      loading,
      refresh: () => refresh(),
      createOrder,
      updateOrder,
      archiveOrder,
      unarchiveOrder,
    }),
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
