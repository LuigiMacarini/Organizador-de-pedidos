import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  if (!meters) return "sem otimização";
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  return `${Math.round(seconds / 60)} min`;
}

export default function RotasScreen() {
  const router = useRouter();
  const { routes, loading } = useRoutes();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Rotas</Text>
          <Text style={styles.subtitle}>Entregas do entregador</Text>
        </View>
        <Pressable
          onPress={() => router.push("/rota/nova")}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.ctaText}>+ Nova rota</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Carregando…</Text>
        </View>
      ) : routes.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Nenhuma rota ainda</Text>
          <Text style={styles.emptyText}>
            Toque em “Nova rota” para selecionar pedidos disponíveis e calcular a ordem de entrega.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {routes.map((r: DeliveryRoute) => (
            <Pressable
              key={r.id}
              onPress={() => router.push(`/rota/${r.id}`)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.statusBadge}>{STATUS_LABEL[r.status]}</Text>
                <Text style={styles.stopCount}>
                  {r.deliveries.length} {r.deliveries.length === 1 ? "parada" : "paradas"}
                </Text>
              </View>
              <Text style={styles.origin} numberOfLines={1}>
                {r.originLabel}
              </Text>
              <View style={styles.cardBottom}>
                <Text style={styles.meta}>
                  {new Date(r.createdAt).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </Text>
                <Text style={styles.meta}>
                  {formatDistance(r.totalDistanceMeters)}
                  {r.totalDurationSeconds ? ` · ${formatDuration(r.totalDurationSeconds)}` : ""}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  subtitle: { marginTop: 4, color: colors.muted, fontSize: 14 },
  cta: {
    backgroundColor: colors.primary,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radii.md,
    minHeight: 44,
    justifyContent: "center",
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm },
  loadingText: { color: colors.muted },
  emptyBox: {
    flex: 1,
    padding: space.xl,
    gap: space.md,
    justifyContent: "center",
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  list: {
    padding: space.lg,
    gap: space.md,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  stopCount: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  origin: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: space.xs },
  meta: { color: colors.muted, fontSize: 12 },
});
