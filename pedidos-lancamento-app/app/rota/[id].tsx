import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../../src/api/httpClient";
import { OrderDetailsModal } from "../../src/components/OrderDetailsModal";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { RouteMap, type MapStop } from "../../src/components/RouteMap";
import { getCurrentDeliveryPosition, useDeliveryLocation } from "../../src/hooks/useDeliveryLocation";
import { useNavigationAnnouncements } from "../../src/hooks/useNavigationAnnouncements";
import { useRoutes } from "../../src/routesContext";
import { colors, fonts, radii, space } from "../../src/theme";
import type { DeliveryRoute, RouteStatus } from "../../src/types";

const STATUS_LABEL: Record<RouteStatus, string> = {
  DRAFT: "Rascunho",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  CANCELED: "Cancelada",
};

function formatDistance(meters: number | null) {
  if (!meters) return "—";
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  return `${Math.round(seconds / 60)} min`;
}

export default function RotaDetalheScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { routes, getRoute, startRoute, cancelRoute, updateDeliveryStatus } = useRoutes();
  const [route, setRoute] = useState<DeliveryRoute | undefined>(() => routes.find((r) => r.id === id));
  const [loading, setLoading] = useState(!route);
  const [busy, setBusy] = useState(false);
  const [busyDeliveryId, setBusyDeliveryId] = useState<string | null>(null);
  const [focusedStopId, setFocusedStopId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [voiceMuted, setVoiceMuted] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setRoute(await getRoute(id));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, getRoute]);

  useEffect(() => {
    void load();
  }, [load]);

  // Hooks precisam rodar sempre, na mesma ordem, mesmo antes de `route`
  // existir — por isso ficam antes do retorno antecipado do loading, com
  // acesso opcional (`route?.`) em vez de depois dele.
  const canExecute = route?.status === "IN_PROGRESS";

  const nextStopId = useMemo(
    () => route?.deliveries.find((d) => d.status === "PENDING")?.id ?? null,
    [route]
  );
  const mapStops: MapStop[] = useMemo(
    () =>
      (route?.deliveries ?? []).map((d) => ({
        id: d.id,
        lat: d.destinationLat,
        lng: d.destinationLng,
        sequence: d.sequence,
        customerName: d.customerName,
        status: d.status,
      })),
    [route]
  );
  // O card técnico com lat/lng/precisão foi removido da UI — o GPS continua
  // rodando aqui só para alimentar o marcador "você está aqui" no mapa.
  const { position: deliveryPosition } = useDeliveryLocation(canExecute);

  const nextStopForVoice = useMemo(() => {
    const stop = route?.deliveries.find((d) => d.id === nextStopId);
    if (!stop) return null;
    return {
      id: stop.id,
      lat: stop.destinationLat,
      lng: stop.destinationLng,
      customerName: stop.customerName,
    };
  }, [route, nextStopId]);

  // Navegação por voz simplificada (ver limitações no hook) — só ativa
  // durante uma rota em execução, igual o rastreamento contínuo de GPS.
  useNavigationAnnouncements(
    canExecute ? nextStopForVoice : null,
    deliveryPosition ? { latitude: deliveryPosition.latitude, longitude: deliveryPosition.longitude } : null,
    voiceMuted
  );

  if (loading || !route) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  const handleStart = async () => {
    setBusy(true);
    try {
      // Leitura pontual do GPS (distinta do rastreamento contínuo que só liga
      // depois que a rota já está IN_PROGRESS) — vira a origem real da rota,
      // usada pelo backend para calcular a ordem de visita e a distância/tempo.
      const position = await getCurrentDeliveryPosition();
      if (!position.ok) {
        const message =
          position.reason === "services-disabled"
            ? "Ative o GPS do celular para iniciar a rota."
            : position.reason === "denied"
            ? "Permissão de localização negada — sem ela não é possível iniciar a rota."
            : "Não foi possível obter sua localização agora. Tente novamente.";
        Alert.alert("Localização necessária", message);
        return;
      }
      await startRoute(route.id, position.latitude, position.longitude);
      await load();
    } catch (e) {
      Alert.alert("Rota", e instanceof ApiError ? e.message : "Não foi possível iniciar a rota.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    const run = async () => {
      setBusy(true);
      try {
        await cancelRoute(route.id);
        router.back();
      } catch (e) {
        Alert.alert("Rota", e instanceof ApiError ? e.message : "Não foi possível cancelar.");
      } finally {
        setBusy(false);
      }
    };

    // Alert.alert com múltiplos botões não dispara onPress corretamente no
    // React Native Web — mesmo problema já tratado em CustomerForm.tsx.
    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" && window.confirm("Cancelar rota? Os pedidos voltam para a lista de disponíveis.");
      if (ok) void run();
      return;
    }

    Alert.alert("Cancelar rota", "Os pedidos voltam para a lista de disponíveis. Continuar?", [
      { text: "Voltar", style: "cancel" },
      { text: "Cancelar rota", style: "destructive", onPress: () => void run() },
    ]);
  };

  const handleDeliveryStatus = async (deliveryId: string, status: "DELIVERED" | "FAILED") => {
    setBusyDeliveryId(deliveryId);
    try {
      // Manda a posição atual do GPS (se já tiver) para o backend recalcular
      // km/tempo restantes a partir de onde o entregador está de verdade.
      // Sem GPS ainda, o backend cai para a posição de onde a rota começou.
      await updateDeliveryStatus(
        deliveryId,
        status,
        undefined,
        deliveryPosition
          ? { latitude: deliveryPosition.latitude, longitude: deliveryPosition.longitude }
          : null
      );
      await load();
    } catch (e) {
      Alert.alert("Entrega", e instanceof ApiError ? e.message : "Não foi possível atualizar a entrega.");
    } finally {
      setBusyDeliveryId(null);
    }
  };

  const canStart = route.status === "DRAFT";
  const canCancel = route.status === "DRAFT" || route.status === "IN_PROGRESS";
  const selectedAddress = route.deliveries.find((d) => d.orderId === selectedOrderId)?.address ?? null;

  return (
    <>
      <Stack.Screen
        options={{
          title: `Rota — ${route.deliveries.length} ${route.deliveries.length === 1 ? "parada" : "paradas"}`,
        }}
      />
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        {/* Fora do ScrollView de propósito: o MapView nativo dentro de um
            ScrollView disputa o gesto de arrastar/pinçar com o scroll da tela
            no React Native. Mapa fixo em cima, lista rola independente embaixo. */}
        <View style={styles.mapWrap}>
          <RouteMap
            stops={mapStops}
            geometry={route.geometry}
            nextStopId={nextStopId}
            currentPosition={
              deliveryPosition
                ? {
                    lat: deliveryPosition.latitude,
                    lng: deliveryPosition.longitude,
                    heading: deliveryPosition.heading,
                  }
                : null
            }
            focusedStopId={focusedStopId}
            height={260}
          />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <Text style={styles.statusBadge}>{STATUS_LABEL[route.status]}</Text>
              {canExecute ? (
                <Pressable
                  onPress={() => setVoiceMuted((prev) => !prev)}
                  hitSlop={8}
                  accessibilityLabel={voiceMuted ? "Ativar voz da navegação" : "Silenciar voz da navegação"}
                >
                  <Ionicons
                    name={voiceMuted ? "volume-mute-outline" : "volume-high-outline"}
                    size={20}
                    color={colors.muted}
                  />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Paradas</Text>
                <Text style={styles.statValue}>{route.deliveries.length}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Distância</Text>
                <Text style={styles.statValue}>{formatDistance(route.totalDistanceMeters)}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Tempo</Text>
                <Text style={styles.statValue}>{formatDuration(route.totalDurationSeconds)}</Text>
              </View>
            </View>
          </View>

          {route.deliveries.map((delivery, index) => (
            <Pressable
              key={delivery.id}
              onPress={() => setSelectedOrderId(delivery.orderId)}
              style={[styles.stopCard, delivery.id === nextStopId && styles.stopCardNext]}
            >
              <View style={styles.stopHeader}>
                <View style={[styles.stopNumber, delivery.id === nextStopId && styles.stopNumberNext]}>
                  <Text style={[styles.stopNumberText, delivery.id === nextStopId && styles.stopNumberTextNext]}>
                    {index + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopCustomer}>{delivery.customerName}</Text>
                  <Text
                    style={[
                      styles.stopStatus,
                      delivery.status === "DELIVERED" && styles.stopStatusOk,
                      delivery.status === "FAILED" && styles.stopStatusFailed,
                    ]}
                  >
                    {delivery.id === nextStopId && canExecute
                      ? "Próxima entrega"
                      : delivery.status === "PENDING"
                      ? "Aguardando"
                      : delivery.status === "DELIVERED"
                      ? "Entregue"
                      : "Não entregue"}
                  </Text>
                </View>
                {/* Ação separada do toque no card (que abre o pedido) — evita dois
                    comportamentos concorrentes no mesmo gesto. */}
                <Pressable
                  onPress={() => setFocusedStopId(delivery.id)}
                  hitSlop={8}
                  style={styles.mapFocusBtn}
                  accessibilityLabel="Ver esta entrega no mapa"
                >
                  <Ionicons name="locate-outline" size={20} color={colors.primary} />
                </Pressable>
              </View>

              {delivery.address ? <Text style={styles.stopAddress}>{delivery.address}</Text> : null}

              {canExecute && delivery.status === "PENDING" ? (
                <View style={styles.stopActions}>
                  <PrimaryButton
                    title="Marcar entregue"
                    onPress={() => void handleDeliveryStatus(delivery.id, "DELIVERED")}
                    loading={busyDeliveryId === delivery.id}
                    disabled={busyDeliveryId !== null}
                  />
                  <View style={styles.stopActionsRow}>
                    <PrimaryButton
                      title="Navegar"
                      variant="ghost"
                      onPress={() => setFocusedStopId(delivery.id)}
                      disabled={busyDeliveryId !== null}
                      style={styles.stopActionBtn}
                    />
                    <PrimaryButton
                      title="Não entregue"
                      variant="ghost"
                      onPress={() => void handleDeliveryStatus(delivery.id, "FAILED")}
                      disabled={busyDeliveryId !== null}
                      style={styles.stopActionBtn}
                    />
                  </View>
                </View>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>

        {canStart || canCancel ? (
          <View style={styles.footer}>
            {canStart ? (
              <PrimaryButton title="Iniciar rota" onPress={() => void handleStart()} loading={busy} disabled={busy} />
            ) : null}
            {canCancel ? (
              <PrimaryButton
                title="Cancelar rota"
                variant="ghost"
                onPress={handleCancel}
                disabled={busy}
                style={{ marginTop: space.sm }}
              />
            ) : null}
          </View>
        ) : null}
      </SafeAreaView>

      <OrderDetailsModal
        orderId={selectedOrderId}
        address={selectedAddress}
        onClose={() => setSelectedOrderId(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  mapWrap: {
    padding: space.lg,
    paddingBottom: 0,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  content: {
    padding: space.lg,
    paddingBottom: space.xl * 2,
    gap: space.md,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  summaryTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statsRow: { flexDirection: "row", alignItems: "center" },
  statTile: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: colors.border },
  statLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  stopCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.md,
  },
  stopCardNext: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  stopHeader: { flexDirection: "row", alignItems: "center", gap: space.md },
  mapFocusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stopNumberNext: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stopNumberText: { fontFamily: fonts.displayBlack, color: colors.text },
  stopNumberTextNext: { color: "#fff" },
  stopCustomer: { fontSize: 16, fontFamily: fonts.display, color: colors.text },
  stopAddress: { fontSize: 14, color: colors.muted, lineHeight: 20, fontFamily: fonts.body },
  stopStatus: { fontSize: 13, color: colors.muted, marginTop: 2, fontFamily: fonts.bodySemiBold },
  stopStatusOk: { color: colors.primary },
  stopStatusFailed: { color: colors.danger },
  stopActions: { gap: space.sm },
  stopActionsRow: { flexDirection: "row", gap: space.sm },
  stopActionBtn: { flex: 1 },
  footer: {
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
});
