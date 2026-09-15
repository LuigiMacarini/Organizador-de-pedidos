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
import { useCustomers } from "../../src/customersContext";
import { getOrderTotal, getOrderUnits } from "../../src/domain/order";
import { useOrders } from "../../src/ordersContext";
import { colors, fonts, radii, space } from "../../src/theme";
import { formatBRL } from "../../src/utils/format";
import type { Order } from "../../src/types";

type Group = {
  customerId: string;
  customerName: string;
  orders: Order[];
  total: number;
};

function groupByCustomer(orders: Order[]): Group[] {
  const map = new Map<string, Group>();
  for (const o of orders) {
    let group = map.get(o.customerId);
    if (!group) {
      group = { customerId: o.customerId, customerName: o.customerName, orders: [], total: 0 };
      map.set(o.customerId, group);
    }
    group.orders.push(o);
    group.total += getOrderTotal(o.items);
  }
  return [...map.values()].sort((a, b) =>
    a.customerName.localeCompare(b.customerName, "pt-BR", { sensitivity: "base" })
  );
}

function isToday(timestamp: number): boolean {
  const d = new Date(timestamp);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function PedidosScreen() {
  const router = useRouter();
  const { orders, loading } = useOrders();
  const { customers } = useCustomers();
  const [query, setQuery] = useState("");

  // `useOrders()` só traz pedidos PENDING (ainda não roteirizados) — assim
  // que um pedido entra numa rota ele some daqui por desenho (ver
  // ordersContext.tsx). "Sem endereço" é derivado do cliente, não do pedido
  // em si, por isso o cruzamento com useCustomers().
  const geocodedCustomerIds = useMemo(
    () => new Set(customers.filter((c) => c.geocodeStatus === "OK").map((c) => c.id)),
    [customers]
  );

  const todayStats = useMemo(() => {
    const todayOrders = orders.filter((o) => isToday(o.createdAt));
    return {
      count: todayOrders.length,
      value: todayOrders.reduce((sum, o) => sum + getOrderTotal(o.items), 0),
    };
  }, [orders]);

  const deliverableCount = useMemo(
    () => orders.filter((o) => geocodedCustomerIds.has(o.customerId)).length,
    [orders, geocodedCustomerIds]
  );

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
          accessibilityLabel="Fechamento mensal"
        >
          <Ionicons name="bar-chart-outline" size={20} color={colors.muted} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/novo")}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.ctaText}>+ Novo</Text>
        </Pressable>
      </View>

      {!loading && orders.length > 0 ? (
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Hoje</Text>
            <Text style={styles.statValue}>
              {todayStats.count} {todayStats.count === 1 ? "pedido" : "pedidos"}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Valor</Text>
            <Text style={styles.statValue}>{formatBRL(todayStats.value)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>A entregar</Text>
            <Text style={styles.statValue}>{deliverableCount}</Text>
          </View>
        </View>
      ) : null}

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
            <View key={g.customerId} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupName} numberOfLines={1}>
                  {g.customerName}
                </Text>
                <Text style={styles.groupMeta}>
                  {g.orders.length} · {formatBRL(g.total)}
                </Text>
              </View>
              {g.orders.map((o) => {
                const units = getOrderUnits(o.items);
                const total = getOrderTotal(o.items);
                const hasAddress = geocodedCustomerIds.has(o.customerId);
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => router.push(`/pedido/${o.id}`)}
                    style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
                  >
                    <View style={styles.cardTop}>
                      <Text style={styles.badge}>
                        {o.items.length} {o.items.length === 1 ? "item" : "itens"} · {units}{" "}
                        {units === 1 ? "unidade" : "unidades"}
                      </Text>
                      <View style={[styles.statusPill, !hasAddress && styles.statusPillWarn]}>
                        <Text style={[styles.statusPillText, !hasAddress && styles.statusPillTextWarn]}>
                          {hasAddress ? "Em aberto" : "Sem endereço"}
                        </Text>
                      </View>
                    </View>
                    {o.notes?.trim() ? (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesLabel}>Observações</Text>
                        <Text style={styles.notesValue} numberOfLines={3} ellipsizeMode="tail">
                          {o.notes.trim()}
                        </Text>
                      </View>
                    ) : null}
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
  title: {
    fontFamily: fonts.displayBlack,
    fontSize: 28,
    letterSpacing: 0.2,
    color: colors.text,
    textTransform: "uppercase",
  },
  subtitle: { marginTop: 2, color: colors.muted, fontSize: 14, fontFamily: fonts.body },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
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
    borderRadius: radii.md,
    minHeight: 44,
    justifyContent: "center",
  },
  ctaText: { color: "#fff", fontFamily: fonts.bodySemiBold, fontSize: 14 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    paddingVertical: space.sm,
    maxWidth: 720,
    width: "auto",
    alignSelf: "center",
  },
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
  searchWrap: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm },
  loadingText: { color: colors.muted, fontFamily: fonts.body },
  emptyBox: {
    flex: 1,
    padding: space.xl,
    gap: space.md,
    justifyContent: "center",
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  emptyTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, fontFamily: fonts.body },
  ctaWide: {
    marginTop: space.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: space.md,
    alignItems: "center",
  },
  ctaWideText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 16, textTransform: "uppercase" },
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
  groupName: { fontFamily: fonts.display, fontSize: 18, color: colors.text, flexShrink: 1 },
  groupMeta: { fontSize: 13, color: colors.muted, fontFamily: fonts.bodySemiBold },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.xs,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  badge: { color: colors.muted, fontSize: 13, fontFamily: fonts.body },
  statusPill: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusPillWarn: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  statusPillText: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statusPillTextWarn: { color: colors.danger },
  notesBox: {
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    maxHeight: 72,
    overflow: "hidden",
    alignSelf: "stretch",
  },
  notesLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  notesValue: { fontSize: 13, color: colors.text, lineHeight: 18, fontFamily: fonts.body },
  cardBottom: {
    marginTop: space.xs,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: space.md,
  },
  meta: { color: colors.muted, fontSize: 12, fontFamily: fonts.body },
  total: { fontSize: 17, fontFamily: fonts.displayBlack, color: colors.text },
});
