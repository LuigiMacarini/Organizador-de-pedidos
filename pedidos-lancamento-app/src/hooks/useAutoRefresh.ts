import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

const DEFAULT_INTERVAL_MS = 12_000;

/**
 * Repete `refresh` a cada `intervalMs` enquanto o app está em primeiro plano.
 * Pausa em segundo plano e atualiza na hora ao voltar, pra não gastar rede/bateria à toa.
 */
export function useAutoRefresh(refresh: () => void, intervalMs = DEFAULT_INTERVAL_MS) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (interval) return;
      interval = setInterval(() => refreshRef.current(), intervalMs);
    };
    const stop = () => {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    };

    if (AppState.currentState === "active") start();

    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        refreshRef.current();
        start();
      } else {
        stop();
      }
    });

    return () => {
      stop();
      subscription.remove();
    };
  }, [intervalMs]);
}
