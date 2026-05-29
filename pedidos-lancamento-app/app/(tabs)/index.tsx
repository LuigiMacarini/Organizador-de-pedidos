import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SearchBar } from "../../src/components/SearchBar";
import { useOrders } from "../../src/ordersContext";
import { colors, radii, space } from "../../src/theme";
import type { Order } from "../../src/types";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Group = {
  key: string;
  customerName: string;
  orders: Order[];
  total: number;
};

function groupByCustomer(orders: Order[]): Group[] {
  const map = new Map<string, Group>();
  for (const o of orders) {
    const key = o.customerId ?? `name:${o.customerName.trim().toLowerCase()}`;
    let group = map.get(key);
    if (!group) {
      group = { key, customerName: o.customerName, orders: [], total: 0 };
      map.set(key, group);
    }
    group.orders.push(o);
    group.total += o.items.reduce((acc, l) => acc + l.unitPrice * l.qty, 0);
  }
  return [...map.values()].sort((a, b) =>
    a.customerName.localeCompare(b.customerName, "pt-BR", { sensitivity: "base" })
  );
}

export default function PedidosScreen() {
  const router = useRouter();
  const { orders, loading } = useOrders();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? orders.filter((o) => o.customerName.toLowerCase().includes(q))
      : orders;
    return groupByCustomer(filtered);
  }, [orders, query]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pedidos</Text>
          <Text style={styles.subtitle}>Lançamentos por cliente</Text>
        </View>
        <Pressable
          onPress={() => router.push("/fechar-mes")}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.85 }]}
          accessibilityLabel="Fechar mês"
        >
          <Ionicons name="trash-bin-outline" size={20} color={colors.danger} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/novo")}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.ctaText}>+ Novo</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar por cliente" />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Carregando…</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Nenhum pedido ainda</Text>
          <Text style={styles.emptyText}>
            Toque em “Novo” para montar o lançamento com busca rápida de produtos.
          </Text>
          <Link href="/novo" asChild>
            <Pressable style={styles.ctaWide}>
              <Text style={styles.ctaWideText}>Criar primeiro pedido</Text>
            </Pressable>
          </Link>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Nenhum resultado</Text>
          <Text style={styles.emptyText}>
            Nenhum pedido encontrado para “{query.trim()}”.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {groups.map((g) => (
            <View key={g.key} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupName} numberOfLines={1}>
                  {g.customerName}
                </Text>
                <Text style={styles.groupMeta}>
                  {g.orders.length} {g.orders.length === 1 ? "pedido" : "pedidos"} ·{" "}
                  {formatBRL(g.total)}
                </Text>
              </View>
              {g.orders.map((o) => {
                const units = o.items.reduce((acc, l) => acc + l.qty, 0);
                const total = o.items.reduce((acc, l) => acc + l.unitPrice * l.qty, 0);
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => router.push(`/pedido/${o.id}`)}
                    style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.995 }] }]}
                  >
                    <View style={styles.cardTop}>
                      <Text style={styles.badge}>
                        {o.items.length} {o.items.length === 1 ? "item" : "itens"} · {units}{" "}
                        {units === 1 ? "unidade" : "unidades"}
                      </Text>
                      {o.notes?.trim() ? (
                        <View style={styles.notesBox}>
                          <Text style={styles.notesLabel}>Observações</Text>
                          <Text style={styles.notesValue} numberOfLines={3} ellipsizeMode="tail">
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
            </View>
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
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  cta: {
    backgroundColor: colors.primary,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radii.lg,
    minHeight: 44,
    justifyContent: "center",
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  searchWrap: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
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
    gap: space.lg,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  group: { gap: space.sm },
  groupHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.sm,
    paddingHorizontal: space.xs,
  },
  groupName: { fontSize: 18, fontWeight: "800", color: colors.text, flexShrink: 1 },
  groupMeta: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { gap: 6, minWidth: 0 },
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
  notesValue: { fontSize: 13, color: colors.text, lineHeight: 18 },
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
