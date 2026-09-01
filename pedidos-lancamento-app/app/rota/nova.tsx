import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { remoteListOrders } from "../../src/api/ordersRemote";
import { ApiError } from "../../src/api/httpClient";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { getOrderTotal } from "../../src/domain/order";
import { useRoutes } from "../../src/routesContext";
import { colors, radii, space } from "../../src/theme";
import { formatBRL } from "../../src/utils/format";
import type { Order } from "../../src/types";

export default function NovaRotaScreen() {
  const router = useRouter();
  const { createRoute } = useRoutes();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await remoteListOrders("deliverable");
        if (active) setOrders(list);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (selected.size === 0) return;
    setCreating(true);
    try {
      const route = await createRoute({ orderIds: [...selected] });
      router.replace(`/rota/${route.id}`);
    } catch (e) {
      Alert.alert("Nova rota", e instanceof ApiError ? e.message : "Não foi possível criar a rota.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Nenhum pedido disponível</Text>
          <Text style={styles.emptyText}>
            Só entram aqui pedidos em aberto cujo cliente já tem endereço com localização confirmada.
            Cadastre ou revise o endereço do cliente para liberá-lo para roteirização.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.list}>
            <Text style={styles.hint}>Selecione os pedidos que vão entrar nesta rota.</Text>
            {orders.map((o) => {
              const isSelected = selected.has(o.id);
              return (
                <Pressable
                  key={o.id}
                  onPress={() => toggle(o.id)}
                  style={({ pressed }) => [
                    styles.card,
                    isSelected && styles.cardSelected,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                    {isSelected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName}>{o.customerName}</Text>
                    <Text style={styles.meta}>
                      {o.items.length} {o.items.length === 1 ? "item" : "itens"} ·{" "}
                      {formatBRL(getOrderTotal(o.items))}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.footer}>
            <PrimaryButton
              title={
                selected.size === 0
                  ? "Selecione ao menos um pedido"
                  : `Criar rota com ${selected.size} ${selected.size === 1 ? "pedido" : "pedidos"}`
              }
              onPress={() => void handleCreate()}
              disabled={selected.size === 0 || creating}
              loading={creating}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
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
    paddingBottom: space.xl * 2,
    gap: space.sm,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  hint: { color: colors.muted, fontSize: 14, marginBottom: space.xs },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 52,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.bg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  customerName: { fontSize: 16, fontWeight: "700", color: colors.text },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
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
