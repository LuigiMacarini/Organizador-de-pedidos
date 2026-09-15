import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import { useAuth } from "../../src/auth/authContext";
import { useCustomers } from "../../src/customersContext";
import { useOrders } from "../../src/ordersContext";
import { colors, fonts, radii, space } from "../../src/theme";
import type { Customer } from "../../src/types";

type FilterKey = "all" | "withOrders" | "noAddress";

function hasNoAddress(c: Customer): boolean {
  return c.geocodeStatus !== "OK";
}

function geoBadge(c: Customer): { label: string; warn: boolean } {
  if (c.geocodeStatus === "OK") return { label: "Geo OK", warn: false };
  if (c.geocodeStatus === "PARTIAL") return { label: "Rever CEP", warn: true };
  return { label: "Sem endereço", warn: true };
}

export default function ClientesScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { customers, loading } = useCustomers();
  const { orders } = useOrders();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const orderCountByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      map.set(o.customerId, (map.get(o.customerId) ?? 0) + 1);
    }
    return map;
  }, [orders]);

  const noAddressCount = useMemo(() => customers.filter(hasNoAddress).length, [customers]);
  const withOrdersCount = useMemo(
    () => customers.filter((c) => (orderCountByCustomer.get(c.id) ?? 0) > 0).length,
    [customers, orderCountByCustomer]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = customers;
    if (filter === "withOrders") list = list.filter((c) => (orderCountByCustomer.get(c.id) ?? 0) > 0);
    else if (filter === "noAddress") list = list.filter(hasNoAddress);
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));
    return list;
  }, [customers, query, filter, orderCountByCustomer]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Clientes</Text>
          <Text style={styles.subtitle}>
            {customers.length} cadastrados
            {noAddressCount > 0 ? ` · ${noAddressCount} sem endereço` : ""}
          </Text>
        </View>
        <Pressable
          onPress={() => void logout()}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.85 }]}
          accessibilityLabel="Sair"
        >
          <Ionicons name="log-out-outline" size={20} color={colors.muted} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/clientes/importar")}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.85 }]}
          accessibilityLabel="Importar clientes via CSV"
        >
          <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/cliente/novo")}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.ctaText}>+ Novo</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar cliente" />
      </View>

      {!loading && customers.length > 0 ? (
        <View style={styles.filtersRow}>
          {(
            [
              { key: "all", label: "Todos", count: customers.length },
              { key: "withOrders", label: "Com pedido", count: withOrdersCount },
              { key: "noAddress", label: "Sem endereço", count: noAddressCount },
            ] as { key: FilterKey; label: string; count: number }[]
          ).map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.filterPill, active && styles.filterPillActive]}
              >
                <Text
                  style={[styles.filterPillText, active && styles.filterPillTextActive]}
                  numberOfLines={1}
                >
                  {f.label} {f.count}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Carregando…</Text>
        </View>
      ) : customers.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Nenhum cliente cadastrado</Text>
          <Text style={styles.emptyText}>
            Toque em “Novo” para cadastrar ou importe uma lista em CSV.
          </Text>
          <Pressable style={styles.ctaWide} onPress={() => router.push("/cliente/novo")}>
            <Text style={styles.ctaWideText}>Cadastrar primeiro cliente</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Nenhum resultado</Text>
          <Text style={styles.emptyText}>
            {query.trim()
              ? `Nenhum cliente encontrado para “${query.trim()}”.`
              : "Nenhum cliente neste filtro."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.map((c) => {
            const count = orderCountByCustomer.get(c.id) ?? 0;
            const badge = geoBadge(c);
            return (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/cliente/${c.id}`)}
                style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.995 }] }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <View style={[styles.badge, badge.warn && styles.badgeWarn]}>
                      <Text style={[styles.badgeText, badge.warn && styles.badgeTextWarn]}>{badge.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>
                    {count} {count === 1 ? "pedido" : "pedidos"} · {c.neighborhood?.trim() || "—"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
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
  searchWrap: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  // Só 3 opções curtas — cabem numa linha só em qualquer celular, sem
  // precisar de ScrollView horizontal. Isso elimina de vez o problema de
  // altura: era o ScrollView (cross-axis entre plataformas nativo/web se
  // comporta diferente) que causava esticar/cortar em cada tentativa
  // anterior. Uma `View` com `flexWrap` nunca tem esse tipo de bug.
  filtersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingHorizontal: space.lg,
    marginBottom: space.sm,
    gap: space.xs,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  filterPill: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterPillText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  filterPillTextActive: { color: "#fff" },
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
    gap: space.sm,
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
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { fontSize: 16, fontFamily: fonts.display, color: colors.text, flexShrink: 1 },
  meta: { marginTop: 2, color: colors.muted, fontSize: 13, fontFamily: fonts.body },
  badge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeWarn: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  badgeText: {
    fontSize: 10,
    fontFamily: fonts.bodySemiBold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  badgeTextWarn: { color: colors.danger },
});
