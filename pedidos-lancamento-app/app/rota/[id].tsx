import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../../src/api/httpClient";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { RouteMap, type MapStop } from "../../src/components/RouteMap";
import { useDeliveryLocation } from "../../src/hooks/useDeliveryLocation";
import { useRoutes } from "../../src/routesContext";
import { colors, radii, space } from "../../src/theme";
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
  const {
    permission: locationPermission,
    position: deliveryPosition,
    error: locationError,
  } = useDeliveryLocation(canExecute);

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
      await startRoute(route.id);
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
      await updateDeliveryStatus(deliveryId, status);
      await load();
    } catch (e) {
      Alert.alert("Entrega", e instanceof ApiError ? e.message : "Não foi possível atualizar a entrega.");
    } finally {
      setBusyDeliveryId(null);
    }
  };

  const canStart = route.status === "DRAFT";
  const canCancel = route.status === "DRAFT" || route.status === "IN_PROGRESS";

  return (
    <>
      <Stack.Screen options={{ title: route.originLabel }} />
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        {/* Fora do ScrollView de propósito: o MapView nativo dentro de um
            ScrollView disputa o gesto de arrastar/pinçar com o scroll da tela
            no React Native. Mapa fixo em cima, lista rola independente embaixo. */}
        <View style={styles.mapWrap}>
          <RouteMap
            origin={{ lat: route.originLat, lng: route.originLng, label: route.originLabel }}
            stops={mapStops}
            geometry={route.geometry}
            nextStopId={nextStopId}
            currentPosition={
              deliveryPosition
                ? { lat: deliveryPosition.latitude, lng: deliveryPosition.longitude }
                : null
            }
            height={260}
          />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <Text style={styles.statusBadge}>{STATUS_LABEL[route.status]}</Text>
              <Text style={styles.summaryMeta}>
                {formatDistance(route.totalDistanceMeters)} · {formatDuration(route.totalDurationSeconds)}
              </Text>
            </View>
            <Text style={styles.originText}>Origem: {route.originLabel}</Text>
          </View>

          {canExecute ? (
            <View style={styles.gpsCard}>
              <Text style={styles.gpsLabel}>Localização</Text>
              {locationPermission === "services-disabled" ? (
                <Text style={styles.gpsWarning}>Ative o GPS do celular para acompanhar sua posição.</Text>
              ) : locationPermission === "denied" ? (
                <Text style={styles.gpsWarning}>
                  Permissão de localização negada — sem ela não é possível acompanhar sua posição na rota.
                </Text>
              ) : locationError ? (
                <Text style={styles.gpsWarning}>{locationError}</Text>
              ) : deliveryPosition ? (
                <Text style={styles.gpsValue}>
                  {deliveryPosition.latitude.toFixed(5)}, {deliveryPosition.longitude.toFixed(5)}
                  {deliveryPosition.accuracy ? ` (±${Math.round(deliveryPosition.accuracy)}m)` : ""}
                </Text>
              ) : (
                <Text style={styles.gpsValue}>Obtendo localização…</Text>
              )}
            </View>
          ) : null}

          {route.deliveries.map((delivery, index) => (
            <View
              key={delivery.id}
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
              </View>

              {delivery.address ? <Text style={styles.stopAddress}>{delivery.address}</Text> : null}

              {canExecute && delivery.status === "PENDING" ? (
                <View style={styles.stopActions}>
                  <PrimaryButton
                    title="Entregue"
                    onPress={() => void handleDeliveryStatus(delivery.id, "DELIVERED")}
                    loading={busyDeliveryId === delivery.id}
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
              ) : null}
            </View>
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
    fontWeight: "800",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryMeta: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  originText: { fontSize: 15, color: colors.text, fontWeight: "600" },
  gpsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  gpsLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  gpsValue: { fontSize: 14, color: colors.text, fontWeight: "600" },
  gpsWarning: { fontSize: 14, color: colors.danger, lineHeight: 20 },
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
  stopNumberText: { fontWeight: "800", color: colors.text },
  stopNumberTextNext: { color: "#fff" },
  stopCustomer: { fontSize: 16, fontWeight: "700", color: colors.text },
  stopAddress: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  stopStatus: { fontSize: 13, color: colors.muted, marginTop: 2, fontWeight: "600" },
  stopStatusOk: { color: colors.primary },
  stopStatusFailed: { color: colors.danger },
  stopActions: { flexDirection: "row", gap: space.sm },
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
