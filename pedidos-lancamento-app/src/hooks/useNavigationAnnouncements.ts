import { useEffect, useRef } from "react";
import * as Speech from "expo-speech";

type AnnounceStop = {
  id: string;
  lat: number;
  lng: number;
  customerName: string;
};

type Coordinate = { latitude: number; longitude: number };

/** Raio a partir do qual consideramos "chegando" na parada; anúncio único por parada. */
const ARRIVAL_RADIUS_METERS = 150;

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const a = sinLat * sinLat + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Navegação por voz simplificada: anuncia quando o entregador entra no raio da
 * próxima parada, usando só distância em linha reta até o cliente.
 * Não é turn-by-turn (sem manobra de rua nem re-roteamento por desvio).
 */
export function useNavigationAnnouncements(
  nextStop: AnnounceStop | null,
  currentPosition: Coordinate | null,
  muted: boolean
) {
  const announcedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (muted || !nextStop || !currentPosition) return;
    if (announcedForRef.current === nextStop.id) return;

    const distance = haversineMeters(
      currentPosition.latitude,
      currentPosition.longitude,
      nextStop.lat,
      nextStop.lng
    );
    if (distance <= ARRIVAL_RADIUS_METERS) {
      announcedForRef.current = nextStop.id;
      Speech.speak(`Você está chegando em ${nextStop.customerName}`, { language: "pt-BR" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    muted,
    nextStop?.id,
    nextStop?.lat,
    nextStop?.lng,
    nextStop?.customerName,
    currentPosition?.latitude,
    currentPosition?.longitude,
  ]);

  // Silenciar deve calar qualquer fala em andamento na hora, não só bloquear a próxima.
  useEffect(() => {
    if (muted) Speech.stop();
  }, [muted]);
}
