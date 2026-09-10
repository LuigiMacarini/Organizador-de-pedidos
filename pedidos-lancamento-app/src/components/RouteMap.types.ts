export type MapStop = {
  id: string;
  lat: number;
  lng: number;
  sequence: number;
  customerName: string;
  status: "PENDING" | "DELIVERED" | "FAILED";
};

export type RouteMapProps = {
  stops: MapStop[];
  /** Polyline codificada devolvida pela Google Routes API — sem ela, cai para linha reta entre os pontos. */
  geometry?: string | null;
  /** Id da parada a destacar como "próxima entrega" (normalmente a primeira PENDING). */
  nextStopId?: string | null;
  /** Posição atual do entregador (GPS). `heading` gira o ícone do veículo — `null`/negativo quando o dispositivo não sabe a direção (ex.: parado). */
  currentPosition?: { lat: number; lng: number; heading?: number | null } | null;
  /** Id da entrega selecionada pelo entregador — centraliza o mapa nela (zoom de bairro), sem refazer o enquadramento da rota inteira. */
  focusedStopId?: string | null;
  height?: number;
};
