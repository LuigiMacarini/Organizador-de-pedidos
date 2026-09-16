import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
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
  /** Direção do deslocamento em graus (0 = norte, sentido horário). `null`/negativo quando o dispositivo não consegue determinar (ex.: parado). */
  heading: number | null;
  /** Velocidade instantânea em m/s. */
  speed: number | null;
  timestamp: number;
};

type UseDeliveryLocationResult = {
  permission: LocationPermissionState;
  position: DeliveryPosition | null;
  error: string | null;
};

/**
 * Acompanha a posição do entregador em primeiro plano enquanto `active` for true
 * (normalmente `route.status === "IN_PROGRESS"`). Para de escutar sozinho quando
 * `active` vira false ou o componente desmonta, nunca coleta localização fora de rota ativa.
 *
 * Só primeiro plano por enquanto; segundo plano fica pra uma fase futura via EAS Build
 * (não funciona no Expo Go).
 */
export function useDeliveryLocation(active: boolean): UseDeliveryLocationResult {
  const [permission, setPermission] = useState<LocationPermissionState>("unknown");
  const [position, setPosition] = useState<DeliveryPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    // A implementação web do expo-location não tem `LocationEventEmitter.removeSubscription`:
    // dar `.remove()` numa subscription de `watchPositionAsync` quebra ao finalizar a rota
    // (rota vira COMPLETED e o hook tenta parar o GPS). GPS contínuo não é caso de uso real
    // na web (é tela de motorista), então só pula aqui.
    if (!active || Platform.OS === "web") {
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
          // Balanced (~100m de precisão) não bastava pra rodovia (carro aparecia em rua
          // paralela). BestForNavigation usa sensores extras e custa mais bateria, mas é
          // o nível certo pra isso. O "pulo" visual do marcador é resolvido no mapa
          // (suavização), não reduzindo o intervalo aqui.
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000,
          distanceInterval: 15,
        },
        (loc) => {
          if (cancelled) return;
          setPosition({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy,
            heading: loc.coords.heading,
            speed: loc.coords.speed,
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

export type CurrentPositionResult =
  | { ok: true; latitude: number; longitude: number; accuracy: number | null }
  | { ok: false; reason: "services-disabled" | "denied" | "unavailable" };

/**
 * Leitura única de GPS (diferente de `useDeliveryLocation`, que é contínua).
 * Usada ao iniciar uma rota, pra capturar de onde o entregador está saindo de fato.
 * Pede permissão uma vez só, sem loop.
 */
export async function getCurrentDeliveryPosition(): Promise<CurrentPositionResult> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) return { ok: false, reason: "services-disabled" };

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return { ok: false, reason: "denied" };

  try {
    // Leitura única, então o custo de bateria da precisão máxima é irrelevante;
    // essa coordenada vira a origem real da rota no Google Routes.
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
    return {
      ok: true,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
