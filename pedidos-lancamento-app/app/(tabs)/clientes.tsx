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
import { useCustomers } from "../../src/customersContext";
import { useOrders } from "../../src/ordersContext";
import { colors, radii, space } from "../../src/theme";

export default function ClientesScreen() {
  const router = useRouter();
  const { customers, loading } = useCustomers();
  const { orders } = useOrders();
  const [query, setQuery] = useState("");

  const orderCountByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      if (!o.customerId) continue;
      map.set(o.customerId, (map.get(o.customerId) ?? 0) + 1);
    }
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, query]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Clientes</Text>
          <Text style={styles.subtitle}>Cadastro local</Text>
        </View>
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
            Nenhum cliente encontrado para “{query.trim()}”.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.map((c) => {
            const count = orderCountByCustomer.get(c.id) ?? 0;
            return (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/cliente/${c.id}`)}
                style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.995 }] }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {c.name}
                  </Text>
                  {c.contact?.trim() ? (
                    <Text style={styles.contact} numberOfLines={1}>
                      {c.contact.trim()}
                    </Text>
                  ) : null}
                  {c.note?.trim() ? (
                    <Text style={styles.note} numberOfLines={1}>
                      {c.note.trim()}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.right}>
                  <Text style={styles.count}>
                    {count} {count === 1 ? "pedido" : "pedidos"}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
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
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  name: { fontSize: 17, fontWeight: "800", color: colors.text },
  contact: { marginTop: 2, color: colors.muted, fontSize: 13 },
  note: { marginTop: 2, color: colors.muted, fontSize: 12 },
  right: { flexDirection: "row", alignItems: "center", gap: space.xs },
  count: { color: colors.muted, fontSize: 13, fontWeight: "600" },
});
