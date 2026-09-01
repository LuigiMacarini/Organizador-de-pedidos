export type MapStop = {
  id: string;
  lat: number;
  lng: number;
  sequence: number;
  customerName: string;
  status: "PENDING" | "DELIVERED" | "FAILED";
};

export type RouteMapProps = {
  origin: { lat: number; lng: number; label: string };
  stops: MapStop[];
  /** Polyline codificada devolvida pela Google Routes API — sem ela, cai para linha reta entre os pontos. */
  geometry?: string | null;
  /** Id da parada a destacar como "próxima entrega" (normalmente a primeira PENDING). */
  nextStopId?: string | null;
  /** Posição atual do entregador (GPS). */
  currentPosition?: { lat: number; lng: number } | null;
  height?: number;
};
