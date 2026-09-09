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
  remoteClearRouteHistory,
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
  startRoute: (id: string, currentLat: number, currentLng: number) => Promise<DeliveryRoute>;
  cancelRoute: (id: string) => Promise<DeliveryRoute>;
  updateDeliveryStatus: (
    deliveryId: string,
    status: "DELIVERED" | "FAILED",
    notes?: string,
    currentPosition?: { latitude: number; longitude: number } | null
  ) => Promise<void>;
  clearHistory: () => Promise<number>;
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

  const startRoute = useCallback(async (id: string, currentLat: number, currentLng: number) => {
    const updated = await remoteStartRoute(id, currentLat, currentLng);
    setRoutes((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

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
    }),
    [routes, loading, refresh, createRoute, getRoute, startRoute, cancelRoute, updateDeliveryStatus, clearHistory]
  );

  return <RoutesContext.Provider value={value}>{children}</RoutesContext.Provider>;
}

export function useRoutes() {
  const ctx = useContext(RoutesContext);
  if (!ctx) throw new Error("useRoutes must be used within RoutesProvider");
  return ctx;
}
