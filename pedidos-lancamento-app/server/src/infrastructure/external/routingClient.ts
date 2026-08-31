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
