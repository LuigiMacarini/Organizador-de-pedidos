/**
 * Único módulo que fala HTTP com o OpenRouteService. Nenhum outro arquivo do
 * backend deve importar `fetch` para essa API diretamente — isso mantém a
 * troca de provedor (se algum dia for necessária) restrita a este arquivo.
 */

const ORS_BASE_URL = "https://api.openrouteservice.org";

function apiKey(): string {
  const key = process.env.ORS_API_KEY;
  if (!key) throw new Error("ORS_API_KEY não configurada");
  return key;
}

export type GeocodeAddressInput = {
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
};

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  /** 0–1, confiança do Pelias no resultado. Sem valor documentado de corte — calibrar com endereços reais. */
  confidence: number;
  /** Endereço formatado que o provedor efetivamente casou — útil para depuração/revisão manual. */
  label: string;
};

type PeliasFeatureCollection = {
  features?: Array<{
    geometry: { coordinates: [number, number] };
    properties?: { confidence?: number; label?: string };
  }>;
};

/**
 * Geocodifica um endereço estruturado via `/geocode/search/structured`.
 * Retorna `null` quando o provedor não encontra nenhum resultado (não é erro).
 */
export async function geocodeAddress(input: GeocodeAddressInput): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({ api_key: apiKey(), size: "1", "boundary.country": "BRA" });

  const address = [input.street, input.number].filter(Boolean).join(", ");
  if (address) params.set("address", address);
  if (input.neighborhood) params.set("neighbourhood", input.neighborhood);
  if (input.city) params.set("locality", input.city);
  if (input.state) params.set("region", input.state);
  if (input.zipCode) params.set("postalcode", input.zipCode);

  const res = await fetch(`${ORS_BASE_URL}/geocode/search/structured?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`OpenRouteService geocoding falhou (HTTP ${res.status})`);
  }

  const data = (await res.json()) as PeliasFeatureCollection;
  const feature = data.features?.[0];
  if (!feature) return null;

  const [longitude, latitude] = feature.geometry.coordinates;
  return {
    latitude,
    longitude,
    confidence: feature.properties?.confidence ?? 0,
    label: feature.properties?.label ?? "",
  };
}

export type Coordinate = { latitude: number; longitude: number };

export type RouteStop = Coordinate & {
  /** Identificador definido pelo chamador (ex.: id da Delivery) — devolvido na ordem otimizada. */
  refId: string;
};

export type OptimizedRoute = {
  /** `refId` de cada parada, na ordem em que devem ser visitadas. */
  order: string[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
};

type VroomStep = { type: string; job?: number; id?: number };
type VroomResponse = {
  routes?: Array<{ distance?: number; duration: number; steps: VroomStep[] }>;
};

/**
 * Calcula a ordem eficiente de visita a `stops`, partindo e retornando a
 * `origin` (um único veículo/entregador). Usa o serviço `/optimization`
 * (solver VROOM) do OpenRouteService.
 *
 * `stops` precisa ter pelo menos 1 parada. VROOM exige ids numéricos para
 * jobs — por isso o índice na lista é usado como id interno, e traduzido de
 * volta para `refId` na resposta.
 */
export async function optimizeRoute(origin: Coordinate, stops: RouteStop[]): Promise<OptimizedRoute> {
  if (stops.length === 0) {
    throw new Error("optimizeRoute chamado sem nenhuma parada");
  }

  const body = {
    jobs: stops.map((stop, index) => ({
      id: index + 1,
      location: [stop.longitude, stop.latitude],
    })),
    vehicles: [
      {
        id: 1,
        profile: "driving-car",
        start: [origin.longitude, origin.latitude],
        end: [origin.longitude, origin.latitude],
      },
    ],
    options: { g: true },
  };

  const res = await fetch(`${ORS_BASE_URL}/optimization`, {
    method: "POST",
    headers: { Authorization: apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`OpenRouteService optimization falhou (HTTP ${res.status})`);
  }

  const data = (await res.json()) as VroomResponse;
  const route = data.routes?.[0];
  if (!route) {
    throw new Error("OpenRouteService não retornou nenhuma rota viável");
  }

  const order = route.steps
    .filter((step) => step.type === "job")
    .map((step) => {
      const jobIndex = (step.job ?? step.id ?? 0) - 1;
      return stops[jobIndex].refId;
    });

  return {
    order,
    totalDistanceMeters: Math.round(route.distance ?? 0),
    totalDurationSeconds: Math.round(route.duration),
  };
}
