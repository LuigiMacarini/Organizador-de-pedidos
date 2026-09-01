import { apiRequest } from "./httpClient";

export type PlaceSuggestion = {
  placeId: string;
  description: string;
};

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

export function remoteAutocompleteAddress(input: string): Promise<PlaceSuggestion[]> {
  return apiRequest<PlaceSuggestion[]>(`/v1/places/autocomplete?input=${encodeURIComponent(input)}`);
}

export function remotePlaceDetails(placeId: string): Promise<PlaceDetails> {
  return apiRequest<PlaceDetails>(`/v1/places/details?placeId=${encodeURIComponent(placeId)}`);
}
