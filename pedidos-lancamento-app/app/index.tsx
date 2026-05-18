import { Link, useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOrders } from "../src/ordersContext";
import { colors, radii, space } from "../src/theme";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function HomeScreen() {
  const router = useRouter();
  const { orders, loading } = useOrders();

  const rows = useMemo(() => orders, [orders]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Pedidos</Text>
          <Text style={styles.subtitle}>Lançamentos por cliente</Text>
        </View>
        <Pressable
          onPress={() => router.push("/novo")}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.ctaText}>+ Novo pedido</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Carregando…</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Nenhum pedido ainda</Text>
          <Text style={styles.emptyText}>
            Toque em “Novo pedido” para montar o lançamento com busca rápida de produtos.
          </Text>
          <Link href="/novo" asChild>
            <Pressable style={styles.ctaWide}>
              <Text style={styles.ctaWideText}>Criar primeiro pedido</Text>
            </Pressable>
          </Link>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {rows.map((o) => {
            const units = o.items.reduce((acc, l) => acc + l.qty, 0);
            const total = o.items.reduce((acc, l) => acc + l.unitPrice * l.qty, 0);
            return (
              <Pressable
                key={o.id}
                onPress={() => router.push(`/pedido/${o.id}`)}
                style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.995 }] }]}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.customer}>{o.customerName}</Text>
                  <Text style={styles.badge}>
                    {o.items.length} {o.items.length === 1 ? "item" : "itens"} · {units}{" "}
                    {units === 1 ? "unidade" : "unidades"}
                  </Text>
                  {o.notes?.trim() ? (
                    <View style={styles.notesBox}>
                      <Text style={styles.notesLabel}>Observações</Text>
                      <Text
                        style={styles.notesValue}
                        numberOfLines={3}
                        ellipsizeMode="tail"
                      >
                        {o.notes.trim()}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.cardBottom}>
                  <Text style={styles.meta}>
                    {new Date(o.updatedAt).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </Text>
                  <Text style={styles.total}>{formatBRL(total)}</Text>
                </View>
              </Pressable>
            );
          })}
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
    paddingBottom: space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
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
    borderRadius: radii.lg,
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
  ctaWide: {
    marginTop: space.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: space.md,
    alignItems: "center",
  },
  ctaWideText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  list: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl * 2,
    gap: space.md,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { gap: 6, minWidth: 0 },
  customer: { fontSize: 17, fontWeight: "800", color: colors.text },
  badge: { color: colors.muted, fontSize: 13 },
  notesBox: {
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    maxHeight: 72,
    overflow: "hidden",
    alignSelf: "stretch",
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  notesValue: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  cardBottom: {
    marginTop: space.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: space.md,
  },
  meta: { color: colors.muted, fontSize: 12 },
  total: { fontSize: 16, fontWeight: "900", color: colors.text },
});
