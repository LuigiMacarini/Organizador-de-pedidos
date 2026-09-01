import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  remoteCancelRoute,
  remoteCreateRoute,
  remoteGetRoute,
  remoteListRoutes,
  remoteStartRoute,
  remoteUpdateDeliveryStatus,
  type CreateRouteInput,
} from "./api/routesRemote";
import { useAuth } from "./auth/authContext";
import type { DeliveryRoute } from "./types";

type RoutesContextValue = {
  routes: DeliveryRoute[];
  loading: boolean;
  refresh: () => Promise<void>;
  createRoute: (input: CreateRouteInput) => Promise<DeliveryRoute>;
  getRoute: (id: string) => Promise<DeliveryRoute>;
  startRoute: (id: string) => Promise<DeliveryRoute>;
  cancelRoute: (id: string) => Promise<DeliveryRoute>;
  updateDeliveryStatus: (deliveryId: string, status: "DELIVERED" | "FAILED", notes?: string) => Promise<void>;
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

  const startRoute = useCallback(async (id: string) => {
    const updated = await remoteStartRoute(id);
    setRoutes((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const cancelRoute = useCallback(async (id: string) => {
    const updated = await remoteCancelRoute(id);
    setRoutes((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const updateDeliveryStatus = useCallback(
    async (deliveryId: string, status: "DELIVERED" | "FAILED", notes?: string) => {
      await remoteUpdateDeliveryStatus(deliveryId, status, notes);
    },
    []
  );

  const value = useMemo(
    () => ({ routes, loading, refresh, createRoute, getRoute, startRoute, cancelRoute, updateDeliveryStatus }),
    [routes, loading, refresh, createRoute, getRoute, startRoute, cancelRoute, updateDeliveryStatus]
  );

  return <RoutesContext.Provider value={value}>{children}</RoutesContext.Provider>;
}

export function useRoutes() {
  const ctx = useContext(RoutesContext);
  if (!ctx) throw new Error("useRoutes must be used within RoutesProvider");
  return ctx;
}
