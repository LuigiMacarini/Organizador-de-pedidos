/**
 * Único módulo que fala HTTP com o Google Maps Platform. Nenhum outro
 * arquivo do backend deve importar `fetch` para essas APIs diretamente —
 * isso mantém a troca de provedor (se algum dia for necessária) restrita a
 * este arquivo. (Antes usava OpenRouteService — trocado por decisão
 * explícita do projeto, billing já configurado.)
 */

const GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const PLACES_AUTOCOMPLETE_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json";
const PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY não configurada");
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

/**
 * Precisão do resultado, conforme a própria Google classifica:
 * `ROOFTOP` = ponto exato do endereço; `RANGE_INTERPOLATED` = interpolado
 * entre números conhecidos na mesma rua (ainda confiável); `GEOMETRIC_CENTER`
 * = centro de uma rua/área inteira (o mesmo problema de "centroide" que
 * identificamos com o provedor anterior); `APPROXIMATE` = o mais vago.
 */
export type GeocodeLocationType = "ROOFTOP" | "RANGE_INTERPOLATED" | "GEOMETRIC_CENTER" | "APPROXIMATE";

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  /** Endereço formatado que a Google efetivamente casou — útil pra revisão manual. */
  label: string;
  locationType: GeocodeLocationType;
  /** `true` quando a Google não teve certeza de que o resultado corresponde exatamente ao endereço enviado. */
  partialMatch: boolean;
};

type GoogleGeocodeResponse = {
  status: string;
  results: Array<{
    formatted_address: string;
    geometry: {
      location: { lat: number; lng: number };
      location_type: GeocodeLocationType;
    };
    partial_match?: boolean;
  }>;
};

/**
 * Geocodifica um endereço estruturado via Geocoding API. Diferente do
 * provedor anterior (busca estruturada com filtros rígidos), a Google usa
 * texto livre com parsing tolerante — por isso montamos uma única string
 * com todos os campos, incluindo bairro (aqui não atrapalha o resultado).
 * Retorna `null` quando não encontra nada (não é erro).
 */
export async function geocodeAddress(input: GeocodeAddressInput): Promise<GeocodeResult | null> {
  const address = [
    [input.street, input.number].filter(Boolean).join(", "),
    input.neighborhood,
    input.city,
    input.state,
    input.zipCode,
    "Brasil",
  ]
    .filter(Boolean)
    .join(", ");

  const params = new URLSearchParams({ address, key: apiKey(), region: "br" });
  const res = await fetch(`${GEOCODING_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Google Geocoding falhou (HTTP ${res.status})`);
  }

  const data = (await res.json()) as GoogleGeocodeResponse;
  if (data.status === "ZERO_RESULTS") return null;
  if (data.status !== "OK") {
    throw new Error(`Google Geocoding retornou status ${data.status}`);
  }

  const result = data.results[0];
  if (!result) return null;

  return {
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    label: result.formatted_address,
    locationType: result.geometry.location_type,
    partialMatch: result.partial_match ?? false,
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
  /** Polyline codificada (mesmo formato Google/OSRM padrão — compatível com o decoder já existente no frontend). */
  geometry: string | null;
};

type ComputeRoutesResponse = {
  routes?: Array<{
    duration?: string;
    distanceMeters?: number;
    polyline?: { encodedPolyline?: string };
    optimizedIntermediateWaypointIndex?: number[];
  }>;
};

function toWaypoint(c: Coordinate) {
  return { location: { latLng: { latitude: c.latitude, longitude: c.longitude } } };
}

/** POST cru em `computeRoutes` — compartilhado por `optimizeRoute` e `computeRouteMetrics`, mesma API/chave/field mask. */
async function callComputeRoutes(body: Record<string, unknown>): Promise<NonNullable<ComputeRoutesResponse["routes"]>[number]> {
  const intermediates = Array.isArray(body.intermediates) ? body.intermediates.length : 0;
  console.log(
    `[Google Routes] computeRoutes chamado — optimizeWaypointOrder=${body.optimizeWaypointOrder}, paradas=${intermediates}`
  );

  const res = await fetch(ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Routes falhou (HTTP ${res.status}): ${text}`);
  }

  const data = (await res.json()) as ComputeRoutesResponse;
  const route = data.routes?.[0];
  if (!route) {
    throw new Error("Google Routes não retornou nenhuma rota viável");
  }
  return route;
}

/**
 * Calcula a ordem eficiente de visita a `stops`, partindo da `origin` e
 * retornando a ela (viagem de ida e volta ao depósito). Usa a Routes API
 * (`computeRoutes`) com `optimizeWaypointOrder: true`.
 */
export async function optimizeRoute(origin: Coordinate, stops: RouteStop[]): Promise<OptimizedRoute> {
  if (stops.length === 0) {
    throw new Error("optimizeRoute chamado sem nenhuma parada");
  }

  const route = await callComputeRoutes({
    origin: toWaypoint(origin),
    destination: toWaypoint(origin),
    intermediates: stops.map(toWaypoint),
    travelMode: "DRIVE",
    optimizeWaypointOrder: true,
  });

  const orderIndexes = route.optimizedIntermediateWaypointIndex ?? stops.map((_, i) => i);
  const order = orderIndexes.map((i) => stops[i].refId);
  const durationSeconds = route.duration ? Math.round(parseFloat(route.duration.replace("s", ""))) : 0;

  return {
    order,
    totalDistanceMeters: route.distanceMeters ?? 0,
    totalDurationSeconds: durationSeconds,
    geometry: route.polyline?.encodedPolyline ?? null,
  };
}

export type RouteMetrics = {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  geometry: string | null;
};

/**
 * Distância/duração/geometria para uma sequência de paradas JÁ DEFINIDA, sem
 * reotimizar a ordem (`optimizeWaypointOrder: false`) — usado para recalcular
 * o restante de uma rota em andamento depois que uma entrega é concluída.
 * Reotimizar a sequência é feature futura; aqui só medimos o trajeto que já
 * está decidido. Fecha em `destination` — mesma definição de "distância/tempo
 * total" usada na criação da rota (round-trip até o depósito).
 */
export async function computeRouteMetrics(
  origin: Coordinate,
  orderedStops: Coordinate[],
  destination: Coordinate
): Promise<RouteMetrics> {
  const route = await callComputeRoutes({
    origin: toWaypoint(origin),
    destination: toWaypoint(destination),
    intermediates: orderedStops.map(toWaypoint),
    travelMode: "DRIVE",
    optimizeWaypointOrder: false,
  });

  const durationSeconds = route.duration ? Math.round(parseFloat(route.duration.replace("s", ""))) : 0;

  return {
    totalDistanceMeters: route.distanceMeters ?? 0,
    totalDurationSeconds: durationSeconds,
    geometry: route.polyline?.encodedPolyline ?? null,
  };
}

export type PlaceSuggestion = {
  placeId: string;
  description: string;
};

type AutocompleteResponse = {
  status: string;
  predictions: Array<{ place_id: string; description: string }>;
};

/** Sugestões de endereço conforme o usuário digita — usado no cadastro de cliente. */
export async function autocompleteAddress(input: string): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({
    input,
    key: apiKey(),
    components: "country:br",
    language: "pt-BR",
  });
  const res = await fetch(`${PLACES_AUTOCOMPLETE_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Google Places autocomplete falhou (HTTP ${res.status})`);
  }
  const data = (await res.json()) as AutocompleteResponse;
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places autocomplete retornou status ${data.status}`);
  }
  return (data.predictions ?? []).map((p) => ({ placeId: p.place_id, description: p.description }));
}

export type PlaceDetails = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
};

type PlaceDetailsResponse = {
  status: string;
  result?: {
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
    address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
  };
};

/** Detalhes completos de um lugar escolhido no autocomplete — inclui coordenada exata e endereço decomposto. */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const params = new URLSearchParams({
    place_id: placeId,
    key: apiKey(),
    language: "pt-BR",
    fields: "formatted_address,geometry,address_component",
  });
  const res = await fetch(`${PLACE_DETAILS_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Google Place Details falhou (HTTP ${res.status})`);
  }
  const data = (await res.json()) as PlaceDetailsResponse;
  if (data.status !== "OK" || !data.result) return null;

  const comp = (type: string) =>
    data.result!.address_components.find((c) => c.types.includes(type))?.long_name ?? null;
  const state = data.result.address_components.find((c) => c.types.includes("administrative_area_level_1"))
    ?.short_name;

  return {
    latitude: data.result.geometry.location.lat,
    longitude: data.result.geometry.location.lng,
    formattedAddress: data.result.formatted_address,
    street: comp("route"),
    number: comp("street_number"),
    neighborhood: comp("sublocality") ?? comp("sublocality_level_1") ?? comp("neighborhood"),
    city: comp("administrative_area_level_2") ?? comp("locality"),
    state: state ?? null,
    zipCode: comp("postal_code"),
  };
}
