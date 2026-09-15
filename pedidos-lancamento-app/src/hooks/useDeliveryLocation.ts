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
    // A implementação web do expo-location não tem `LocationEventEmitter.
    // removeSubscription` — chamar `.remove()` numa subscription de
    // `watchPositionAsync` quebra com "removeSubscription is not a function"
    // (reproduzido ao marcar a última entrega: a rota vira COMPLETED e o
    // hook tenta parar o GPS). Navegação com GPS contínuo nunca foi um caso
    // de uso real na web (é tela de motorista, não de navegador) — só pula.
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
          // Balanced (nível 3 de 6) é documentado como "accurate to within one
          // hundred meters" — insuficiente pra navegação em rodovia (o carro
          // aparecia em rua paralela). BestForNavigation é o nível que a própria
          // expo-location descreve como pensado pra isso, usando sensores
          // adicionais. Custa mais bateria — trade-off deliberado, documentado
          // na conversa. timeInterval/distanceInterval não mudaram: o "pulo"
          // visual é resolvido com suavização no mapa, não com mais polling.
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
 * Leitura pontual de GPS (não contínua, diferente de `useDeliveryLocation`)
 * — usada só na ação de iniciar uma rota, para capturar de onde o
 * entregador está saindo de verdade nesse momento. Pede permissão no
 * máximo uma vez por chamada (nunca em loop).
 */
export async function getCurrentDeliveryPosition(): Promise<CurrentPositionResult> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) return { ok: false, reason: "services-disabled" };

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return { ok: false, reason: "denied" };

  try {
    // Leitura única — custo de bateria de usar a precisão máxima aqui é
    // irrelevante (não é contínuo), e essa coordenada vira a origem real da
    // rota no Google Routes, então vale a pena ser a mais precisa possível.
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
