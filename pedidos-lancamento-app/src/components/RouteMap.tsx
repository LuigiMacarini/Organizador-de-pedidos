import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { decodePolyline } from "../utils/polyline";
import { colors, radii } from "../theme";

export type MapStop = {
  id: string;
  lat: number;
  lng: number;
  sequence: number;
  customerName: string;
  status: "PENDING" | "DELIVERED" | "FAILED";
};

type Props = {
  origin: { lat: number; lng: number; label: string };
  stops: MapStop[];
  /** Polyline codificada devolvida pelo OpenRouteService — sem ela, cai para linha reta entre os pontos. */
  geometry?: string | null;
  /** Id da parada a destacar como "próxima entrega" (normalmente a primeira PENDING). */
  nextStopId?: string | null;
  /** Posição atual do entregador (GPS). Atualiza um marcador sem recarregar o mapa. */
  currentPosition?: { lat: number; lng: number } | null;
  height?: number;
};

/**
 * Mapa dentro do próprio ORG — WebView com Leaflet + tiles do OpenStreetMap
 * (gratuito, sem chave). Desenha a geometria real da rota (decodificada da
 * polyline do OpenRouteService), marcadores de origem/paradas com a próxima
 * entrega destacada, e a posição ao vivo do entregador. Nunca sai do app.
 */
export function RouteMap({ origin, stops, geometry, nextStopId, currentPosition, height = 320 }: Props) {
  const webviewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  // O HTML só é recalculado quando o desenho da rota muda de verdade (rota,
  // paradas, geometria, próxima entrega) — nunca por causa do GPS. A posição
  // do entregador é injetada depois via JS (updateDeliveryPosition), sem
  // recarregar a WebView: recarregar a cada poucos segundos perderia o
  // zoom/pan que o usuário já tiver feito no mapa.
  const html = useMemo(
    () => buildMapHtml(origin, stops, geometry ?? null, nextStopId ?? null),
    [origin.lat, origin.lng, origin.label, JSON.stringify(stops), geometry, nextStopId]
  );

  useEffect(() => {
    setReady(false);
  }, [html]);

  useEffect(() => {
    if (!ready || !currentPosition) return;
    webviewRef.current?.injectJavaScript(
      `window.updateDeliveryPosition && window.updateDeliveryPosition(${currentPosition.lat}, ${currentPosition.lng}); true;`
    );
  }, [ready, currentPosition]);

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={webviewRef}
        source={{ html }}
        style={styles.webview}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        onLoadEnd={() => setReady(true)}
      />
    </View>
  );
}

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function buildMapHtml(
  origin: Props["origin"],
  stops: MapStop[],
  geometry: string | null,
  nextStopId: string | null
): string {
  const path: [number, number][] = geometry
    ? decodePolyline(geometry)
    : [[origin.lat, origin.lng], ...stops.map((s): [number, number] => [s.lat, s.lng])];

  const stopMarkersJs = stops
    .map((s) => {
      const isNext = s.id === nextStopId;
      const color =
        s.status === "DELIVERED"
          ? colors.primary
          : s.status === "FAILED"
          ? colors.danger
          : isNext
          ? colors.primary
          : colors.muted;
      const size = isNext ? 34 : 26;
      const label = s.status === "DELIVERED" ? "✓" : s.status === "FAILED" ? "!" : String(s.sequence);
      const popupText = JSON.stringify(`${s.sequence}. ${s.customerName}`);
      const iconHtml = JSON.stringify(
        `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${
          isNext ? 15 : 13
        }px;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);">${label}</div>`
      );
      return `L.marker([${s.lat}, ${s.lng}], {
        icon: L.divIcon({ className: '', html: ${iconHtml}, iconSize: [${size}, ${size}], iconAnchor: [${size / 2}, ${size / 2}] }),
      }).addTo(map).bindPopup(${popupText});`;
    })
    .join("\n");

  const originIconHtml = JSON.stringify(
    `<div style="width:28px;height:28px;border-radius:6px;background:${colors.text};color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);">\u{1F3E0}</div>`
  );

  const primaryRgb = hexToRgb(colors.primary);

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .delivery-dot {
      width: 16px; height: 16px; border-radius: 50%;
      background: ${colors.primary}; border: 3px solid #fff;
      animation: delivery-pulse 2s infinite;
    }
    @keyframes delivery-pulse {
      0% { box-shadow: 0 0 0 0 rgba(${primaryRgb}, 0.5); }
      70% { box-shadow: 0 0 0 14px rgba(${primaryRgb}, 0); }
      100% { box-shadow: 0 0 0 0 rgba(${primaryRgb}, 0); }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    var path = ${JSON.stringify(path)};

    L.marker([${origin.lat}, ${origin.lng}], {
      icon: L.divIcon({ className: '', html: ${originIconHtml}, iconSize: [28, 28], iconAnchor: [14, 14] }),
    }).addTo(map).bindPopup(${JSON.stringify(origin.label)});

    ${stopMarkersJs}

    if (path.length > 1) {
      var poly = L.polyline(path, { color: '${colors.primary}', weight: 4, opacity: 0.8 }).addTo(map);
      map.fitBounds(poly.getBounds(), { padding: [36, 36] });
    } else {
      map.setView([${origin.lat}, ${origin.lng}], 13);
    }

    // Posição ao vivo do entregador — chamado de fora via injectJavaScript,
    // sem recarregar a página (ver RouteMap.tsx).
    var deliveryMarker = null;
    var deliveryCentered = false;
    window.updateDeliveryPosition = function (lat, lng) {
      if (!deliveryMarker) {
        deliveryMarker = L.marker([lat, lng], {
          icon: L.divIcon({ className: '', html: '<div class="delivery-dot"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
          zIndexOffset: 1000,
        }).addTo(map).bindPopup('Você está aqui');
      } else {
        deliveryMarker.setLatLng([lat, lng]);
      }
      if (!deliveryCentered) {
        deliveryCentered = true;
        map.panTo([lat, lng]);
      }
    };
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  webview: { flex: 1, backgroundColor: colors.surface },
});
