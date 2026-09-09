import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
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
 * da Google Routes API), marcadores de origem/paradas com a próxima entrega
 * destacada, e a posição do entregador. Nunca sai do app.
 *
 * Versão só para Android/iOS (Metro resolve `.native.tsx` automaticamente
 * nessas plataformas) — react-native-maps não roda na web, ver RouteMap.web.tsx.
 */
export function RouteMap({
  origin,
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
    const points: [number, number][] =
      decoded ?? [[origin.lat, origin.lng], ...stops.map((s): [number, number] => [s.lat, s.lng])];
    return points.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin.lat, origin.lng, geometry, JSON.stringify(stops.map((s) => [s.lat, s.lng]))]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const coords = path.length > 1 ? path : [{ latitude: origin.lat, longitude: origin.lng }];
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
      animated: false,
    });
  }, [mapReady, path, origin.lat, origin.lng]);

  // Centraliza numa entrega específica quando o entregador toca no card dela
  // — só move a câmera (mesmo mapa, mesmos marcadores). Depende só do id
  // selecionado, não da lista de paradas: se o status de uma entrega mudar
  // enquanto ela está em foco, a câmera não deve pular sozinha.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !focusedStopId) return;
    const target = stops.find((s) => s.id === focusedStopId);
    if (!target) return;
    mapRef.current.animateToRegion(
      { latitude: target.lat, longitude: target.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      400
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedStopId, mapReady]);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: origin.lat,
          longitude: origin.lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onMapReady={() => setMapReady(true)}
      >
        <Marker
          coordinate={{ latitude: origin.lat, longitude: origin.lng }}
          title={origin.label}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.originMarker}>
            <Text style={styles.originMarkerText}>{"\u{1F3E0}"}</Text>
          </View>
        </Marker>

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

        {currentPosition ? (
          <Marker
            coordinate={{ latitude: currentPosition.lat, longitude: currentPosition.lng }}
            title="Você está aqui"
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={999}
          >
            <View style={styles.vehicleMarker}>
              <Text style={styles.vehicleMarkerText}>{"\u{1F697}"}</Text>
            </View>
          </Marker>
        ) : null}

        {path.length > 1 ? <Polyline coordinates={path} strokeColor={colors.primary} strokeWidth={4} /> : null}
      </MapView>
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
  originMarker: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  originMarkerText: { fontSize: 14 },
  stopMarker: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  stopMarkerText: { color: "#fff", fontWeight: "800" },
  // Distinto de propósito dos marcadores de origem (🏠, quadrado escuro) e
  // paradas (círculo numerado) — o entregador precisa achar "onde estou" de
  // relance, sem confundir com "onde são as entregas".
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
});
