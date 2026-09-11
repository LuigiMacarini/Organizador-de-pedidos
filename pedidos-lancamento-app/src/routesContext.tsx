import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { remoteGetOrder } from "./api/ordersRemote";
import {
  remoteCancelRoute,
  remoteClearRouteHistory,
  remoteCreateRoute,
  remoteGetRoute,
  remoteListRoutes,
  remoteStartRoute,
  remoteUpdateDeliveryStatus,
  type CreateRouteInput,
} from "./api/routesRemote";
import { useAuth } from "./auth/authContext";
import type { DeliveryRoute, Order } from "./types";

type RoutesContextValue = {
  routes: DeliveryRoute[];
  loading: boolean;
  refresh: () => Promise<void>;
  createRoute: (input: CreateRouteInput) => Promise<DeliveryRoute>;
  getRoute: (id: string) => Promise<DeliveryRoute>;
  startRoute: (id: string, currentLat: number, currentLng: number) => Promise<DeliveryRoute>;
  cancelRoute: (id: string) => Promise<DeliveryRoute>;
  updateDeliveryStatus: (
    deliveryId: string,
    status: "DELIVERED" | "FAILED",
    notes?: string,
    currentPosition?: { latitude: number; longitude: number } | null
  ) => Promise<void>;
  clearHistory: () => Promise<number>;
  /** Pedido já pré-carregado ao iniciar a rota (ver `startRoute`) — `undefined` em cache miss, quem chama decide o fallback. */
  getCachedOrder: (orderId: string) => Order | undefined;
};

const RoutesContext = createContext<RoutesContextValue | null>(null);

/**
 * Diferente de Clientes/Pedidos, não usa `useAutoRefresh`: uma rota em
 * execução é usada ativamente por um único dispositivo, e cada ação já
 * atualiza o estado local na hora (ver plano, §8).
 */
export function RoutesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRoutes(await remoteListRoutes());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void refresh();
  }, [user, refresh]);

  const createRoute = useCallback(async (input: CreateRouteInput) => {
    const created = await remoteCreateRoute(input);
    setRoutes((prev) => [created, ...prev]);
    return created;
  }, []);

  const getRoute = useCallback(async (id: string) => {
    const route = await remoteGetRoute(id);
    setRoutes((prev) => (prev.some((r) => r.id === id) ? prev.map((r) => (r.id === id ? route : r)) : [route, ...prev]));
    return route;
  }, []);

  // Cache de pedidos em memória, vivo enquanto o app estiver aberto — não
  // precisa de biblioteca nova (React Query/Zustand/AsyncStorage), o projeto
  // já resolve estado compartilhado com Context, e o volume de dados aqui é
  // sempre pequeno (só os pedidos de rotas que o próprio dispositivo iniciou).
  const orderCacheRef = useRef<Map<string, Order>>(new Map());

  const getCachedOrder = useCallback((orderId: string) => orderCacheRef.current.get(orderId), []);

  /**
   * Só os pedidos DESSA rota (nunca "todos os pedidos do sistema") — buscados
   * em paralelo e guardados no cache antes de `startRoute` devolver. Uma
   * falha pontual num pedido não derruba o início da rota nem os demais: fica
   * como cache miss, e `OrderDetailsModal` já sabe buscar sob demanda nesse
   * caso (mesmo fallback de sempre, só que agora raramente precisa dele).
   */
  const preloadRouteOrders = useCallback(async (route: DeliveryRoute) => {
    await Promise.allSettled(
      route.deliveries.map(async (delivery) => {
        if (orderCacheRef.current.has(delivery.orderId)) return;
        try {
          const order = await remoteGetOrder(delivery.orderId);
          orderCacheRef.current.set(delivery.orderId, order);
        } catch (e) {
          console.warn(`[RoutesProvider] Falha ao pré-carregar pedido ${delivery.orderId}`, e);
        }
      })
    );
  }, []);

  const startRoute = useCallback(
    async (id: string, currentLat: number, currentLng: number) => {
      const updated = await remoteStartRoute(id, currentLat, currentLng);
      setRoutes((prev) => prev.map((r) => (r.id === id ? updated : r)));
      await preloadRouteOrders(updated);
      return updated;
    },
    [preloadRouteOrders]
  );

  const cancelRoute = useCallback(async (id: string) => {
    const updated = await remoteCancelRoute(id);
    setRoutes((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const updateDeliveryStatus = useCallback(
    async (
      deliveryId: string,
      status: "DELIVERED" | "FAILED",
      notes?: string,
      currentPosition?: { latitude: number; longitude: number } | null
    ) => {
      await remoteUpdateDeliveryStatus(deliveryId, status, notes, currentPosition);
    },
    []
  );

  const clearHistory = useCallback(async () => {
    const { deleted } = await remoteClearRouteHistory();
    setRoutes((prev) => prev.filter((r) => r.status !== "COMPLETED" && r.status !== "CANCELED"));
    return deleted;
  }, []);

  const value = useMemo(
    () => ({
      routes,
      loading,
      refresh,
      createRoute,
      getRoute,
      startRoute,
      cancelRoute,
      updateDeliveryStatus,
      clearHistory,
      getCachedOrder,
    }),
    [
      routes,
      loading,
      refresh,
      createRoute,
      getRoute,
      startRoute,
      cancelRoute,
      updateDeliveryStatus,
      clearHistory,
      getCachedOrder,
    ]
  );

  return <RoutesContext.Provider value={value}>{children}</RoutesContext.Provider>;
}

export function useRoutes() {
  const ctx = useContext(RoutesContext);
  if (!ctx) throw new Error("useRoutes must be used within RoutesProvider");
  return ctx;
}
