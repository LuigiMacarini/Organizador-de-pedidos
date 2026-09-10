import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, {
  AnimatedRegion,
  Marker,
  MarkerAnimated,
  Polyline,
  PROVIDER_GOOGLE,
  type MapMarker,
} from "react-native-maps";
import { decodePolyline } from "../utils/polyline";
import { colors, radii } from "../theme";
import type { MapStop, RouteMapProps } from "./RouteMap.types";

export type { MapStop };

function stopColor(stop: MapStop, isNext: boolean): string {
  if (stop.status === "DELIVERED") return colors.primary;
  if (stop.status === "FAILED") return colors.danger;
  if (isNext) return colors.primary;
  return colors.muted;
}

/**
 * Mapa nativo (Google Maps via react-native-maps) dentro do próprio ORG —
 * substitui a WebView com Leaflet/OpenStreetMap usada antes. Exige dev build
 * (não funciona no Expo Go) e a chave do Maps SDK configurada em
 * app.config.js. Desenha a geometria real da rota (decodificada da polyline
 * da Google Routes API), marcadores das paradas com a próxima entrega
 * destacada, e a posição do entregador — sem origem fixa, a única origem é o
 * GPS do entregador ao iniciar a rota. Nunca sai do app.
 *
 * Versão só para Android/iOS (Metro resolve `.native.tsx` automaticamente
 * nessas plataformas) — react-native-maps não roda na web, ver RouteMap.web.tsx.
 */
export function RouteMap({
  stops,
  geometry,
  nextStopId,
  currentPosition,
  focusedStopId,
  height = 320,
}: RouteMapProps) {
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);

  // Só recalcula quando o desenho da rota muda de verdade (rota, paradas,
  // geometria) — nunca por causa do GPS, que só move um marcador.
  const path = useMemo(() => {
    const decoded = geometry ? decodePolyline(geometry) : null;
    const points: [number, number][] = decoded ?? stops.map((s): [number, number] => [s.lat, s.lng]);
    return points.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, JSON.stringify(stops.map((s) => [s.lat, s.lng]))]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || path.length === 0) return;
    mapRef.current.fitToCoordinates(path, {
      edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
      animated: false,
    });
  }, [mapReady, path]);

  // Centraliza numa entrega específica quando o entregador toca no card dela
  // — só move a câmera (mesmo mapa, mesmos marcadores). Depende só do id
  // selecionado, não da lista de paradas: se o status de uma entrega mudar
  // enquanto ela está em foco, a câmera não deve pular sozinha.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !focusedStopId) return;
    const target = stops.find((s) => s.id === focusedStopId);
    if (!target) return;
    setFollowing(false);
    mapRef.current.animateToRegion(
      { latitude: target.lat, longitude: target.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      400
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedStopId, mapReady]);

  // "Seguir o veículo": liga sozinho assim que a primeira posição de GPS
  // chega (início da navegação) — não a cada atualização, só na entrada no
  // modo. Arrastar o mapa manualmente ou focar uma parada específica desliga
  // (o entregador tomou controle); o botão de recentralizar liga de novo.
  const [following, setFollowing] = useState(false);
  const hadPositionRef = useRef(false);

  useEffect(() => {
    if (currentPosition && !hadPositionRef.current) {
      hadPositionRef.current = true;
      setFollowing(true);
    } else if (!currentPosition) {
      hadPositionRef.current = false;
      setFollowing(false);
    }
  }, [currentPosition]);

  useEffect(() => {
    if (!following || !currentPosition || !mapReady || !mapRef.current) return;
    mapRef.current.animateCamera(
      { center: { latitude: currentPosition.lat, longitude: currentPosition.lng }, zoom: 17 },
      { duration: 500 }
    );
  }, [following, currentPosition, mapReady]);

  // Suavização visual do marcador do veículo: sem isso, cada atualização de
  // GPS (a cada ~5s) faz o ícone "pular" de uma posição pra outra — em
  // rodovia, o carro real anda 100m+ nesse intervalo. Isso só anima a
  // TRANSIÇÃO entre duas posições reais já confirmadas pelo GPS — nunca
  // inventa/extrapola uma posição que o GPS não relatou. Android e iOS
  // exigem APIs diferentes do react-native-maps para animação nativa de
  // marcador (não são intercambiáveis).
  const vehicleMarkerRef = useRef<MapMarker>(null);
  const initialVehicleCoordRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const animatedVehicleRegion = useRef(
    new AnimatedRegion({ latitude: 0, longitude: 0, latitudeDelta: 0, longitudeDelta: 0 })
  ).current;

  useEffect(() => {
    if (!currentPosition) return;
    const coordinate = { latitude: currentPosition.lat, longitude: currentPosition.lng };

    if (!initialVehicleCoordRef.current) {
      // Primeira posição desta sessão: define direto, não há de onde animar.
      initialVehicleCoordRef.current = coordinate;
      animatedVehicleRegion.setValue({ ...coordinate, latitudeDelta: 0, longitudeDelta: 0 });
      return;
    }

    if (Platform.OS === "android") {
      vehicleMarkerRef.current?.animateMarkerToCoordinate(coordinate, 1000);
    } else {
      // O .d.ts pede `toValue`, mas a implementação real (lib/AnimatedRegion.js)
      // ignora esse campo e anima cada latitude/longitude/delta individualmente
      // a partir das próprias chaves do objeto — checado direto no fonte
      // instalado. O cast é só pra contornar essa tipagem incompleta.
      animatedVehicleRegion
        .timing({
          ...coordinate,
          latitudeDelta: 0,
          longitudeDelta: 0,
          duration: 1000,
          useNativeDriver: false,
        } as unknown as Parameters<typeof animatedVehicleRegion.timing>[0])
        .start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPosition?.lat, currentPosition?.lng]);

  const vehicleRotation =
    currentPosition?.heading != null && currentPosition.heading >= 0 ? currentPosition.heading : undefined;

  const handleRecenter = () => {
    if (!currentPosition || !mapRef.current) return;
    setFollowing(true);
    mapRef.current.animateCamera(
      { center: { latitude: currentPosition.lat, longitude: currentPosition.lng }, zoom: 17 },
      { duration: 500 }
    );
  };

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: stops[0]?.lat ?? currentPosition?.lat ?? 0,
          longitude: stops[0]?.lng ?? currentPosition?.lng ?? 0,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onMapReady={() => setMapReady(true)}
        onPanDrag={() => setFollowing(false)}
      >
        {stops.map((s) => {
          const isNext = s.id === nextStopId;
          const label = s.status === "DELIVERED" ? "✓" : s.status === "FAILED" ? "!" : String(s.sequence);
          const size = isNext ? 34 : 26;
          return (
            <Marker
              key={`${s.id}-${s.status}-${isNext}`}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              title={`${s.sequence}. ${s.customerName}`}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View
                style={[
                  styles.stopMarker,
                  {
                    backgroundColor: stopColor(s, isNext),
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                  },
                ]}
              >
                <Text style={[styles.stopMarkerText, { fontSize: isNext ? 15 : 13 }]}>{label}</Text>
              </View>
            </Marker>
          );
        })}

        {currentPosition && initialVehicleCoordRef.current ? (
          Platform.OS === "android" ? (
            <Marker
              ref={vehicleMarkerRef}
              coordinate={initialVehicleCoordRef.current}
              title="Você está aqui"
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              rotation={vehicleRotation}
              zIndex={999}
            >
              <View style={styles.vehicleMarker}>
                <Text style={styles.vehicleMarkerText}>{"\u{1F697}"}</Text>
              </View>
            </Marker>
          ) : (
            <MarkerAnimated
              // Mesma tipagem incompleta do react-native-maps (AnimatedRegion é
              // exatamente o tipo esperado em uso real/documentado pela lib).
              coordinate={animatedVehicleRegion as unknown as { latitude: number; longitude: number }}
              title="Você está aqui"
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              rotation={vehicleRotation}
              zIndex={999}
            >
              <View style={styles.vehicleMarker}>
                <Text style={styles.vehicleMarkerText}>{"\u{1F697}"}</Text>
              </View>
            </MarkerAnimated>
          )
        ) : null}

        {path.length > 1 ? <Polyline coordinates={path} strokeColor={colors.primary} strokeWidth={4} /> : null}
      </MapView>

      {currentPosition && !following ? (
        <Pressable onPress={handleRecenter} style={styles.recenterBtn} accessibilityLabel="Voltar para minha localização">
          <Ionicons name="locate" size={22} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  map: { flex: 1 },
  stopMarker: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  stopMarkerText: { color: "#fff", fontWeight: "800" },
  // Distinto de propósito dos marcadores de parada (círculo numerado) — o
  // entregador precisa achar "onde estou" de relance, sem confundir com
  // "onde são as entregas".
  vehicleMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  vehicleMarkerText: { fontSize: 17 },
  recenterBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
});
