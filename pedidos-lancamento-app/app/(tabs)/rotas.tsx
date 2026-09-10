import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
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

const FINISHED_STATUSES: RouteStatus[] = ["COMPLETED", "CANCELED"];

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

function RouteCard({ route, onPress }: { route: DeliveryRoute; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      <View style={styles.cardTop}>
        <Text style={styles.statusBadge}>{STATUS_LABEL[route.status]}</Text>
        <Text style={styles.stopCount}>
          {route.deliveries.length} {route.deliveries.length === 1 ? "parada" : "paradas"}
        </Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {route.deliveries[0]?.customerName ?? "Rota"}
      </Text>
      <View style={styles.cardBottom}>
        <Text style={styles.meta}>
          {new Date(route.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
        </Text>
        <Text style={styles.meta}>
          {formatDistance(route.totalDistanceMeters)}
          {route.totalDurationSeconds ? ` · ${formatDuration(route.totalDurationSeconds)}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

export default function RotasScreen() {
  const router = useRouter();
  const { routes, loading, clearHistory } = useRoutes();
  const [clearing, setClearing] = useState(false);

  const { active, finished } = useMemo(() => {
    const active: DeliveryRoute[] = [];
    const finished: DeliveryRoute[] = [];
    for (const r of routes) {
      (FINISHED_STATUSES.includes(r.status) ? finished : active).push(r);
    }
    return { active, finished };
  }, [routes]);

  const handleClearHistory = () => {
    const run = async () => {
      setClearing(true);
      try {
        await clearHistory();
      } catch (e) {
        console.error(e);
        Alert.alert("Histórico", "Não foi possível limpar o histórico.");
      } finally {
        setClearing(false);
      }
    };

    // Mesmo cuidado de handleCancel em rota/[id].tsx: Alert.alert multi-botão
    // não funciona no React Native Web.
    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" && window.confirm(`Apagar ${finished.length} rota(s) do histórico?`);
      if (ok) void run();
      return;
    }

    Alert.alert("Limpar histórico", `Apagar ${finished.length} rota(s) concluída(s)/cancelada(s)? Isso não afeta os pedidos.`, [
      { text: "Voltar", style: "cancel" },
      { text: "Limpar", style: "destructive", onPress: () => void run() },
    ]);
  };

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
          {active.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ativas</Text>
              {active.map((r) => (
                <RouteCard key={r.id} route={r} onPress={() => router.push(`/rota/${r.id}`)} />
              ))}
            </View>
          ) : null}

          {finished.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Histórico</Text>
                <Pressable onPress={handleClearHistory} disabled={clearing} hitSlop={8}>
                  <Text style={[styles.clearLink, clearing && { opacity: 0.5 }]}>
                    {clearing ? "Limpando…" : "Limpar histórico"}
                  </Text>
                </Pressable>
              </View>
              {finished.map((r) => (
                <RouteCard key={r.id} route={r} onPress={() => router.push(`/rota/${r.id}`)} />
              ))}
            </View>
          ) : null}
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
    gap: space.xl,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  section: { gap: space.md },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  clearLink: { fontSize: 13, fontWeight: "700", color: colors.danger },
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
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: space.xs },
  meta: { color: colors.muted, fontSize: 12 },
});
