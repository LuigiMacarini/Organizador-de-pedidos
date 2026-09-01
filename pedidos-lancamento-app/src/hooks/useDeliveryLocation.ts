import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

export type LocationPermissionState =
  | "unknown"
  | "granted"
  | "denied"
  | "services-disabled";

export type DeliveryPosition = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

type UseDeliveryLocationResult = {
  permission: LocationPermissionState;
  position: DeliveryPosition | null;
  error: string | null;
};

/**
 * Acompanha a posição do entregador em primeiro plano enquanto `active` for
 * true (normalmente `route.status === "IN_PROGRESS"`). Some de escutar
 * automaticamente quando `active` vira false ou o componente desmonta —
 * nunca continua coletando localização fora de uma rota ativa (plano de GPS,
 * seção 11: parar o acompanhamento ao finalizar/cancelar).
 *
 * Só primeiro plano por enquanto — segundo plano fica para uma fase futura,
 * quando o app já estiver rodando via EAS Build (não funciona no Expo Go).
 */
export function useDeliveryLocation(active: boolean): UseDeliveryLocationResult {
  const [permission, setPermission] = useState<LocationPermissionState>("unknown");
  const [position, setPosition] = useState<DeliveryPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!active) {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      setPosition(null);
      return;
    }

    let cancelled = false;

    const start = async () => {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        if (!cancelled) setPermission("services-disabled");
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (!cancelled) setPermission("denied");
        return;
      }
      if (cancelled) return;
      setPermission("granted");

      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 15,
        },
        (loc) => {
          if (cancelled) return;
          setPosition({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy,
            timestamp: loc.timestamp,
          });
        }
      );
    };

    start().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "Não foi possível obter a localização.");
    });

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [active]);

  return { permission, position, error };
}
