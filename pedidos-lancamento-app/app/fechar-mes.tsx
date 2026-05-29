import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { useOrders } from "../src/ordersContext";
import { colors, radii, space } from "../src/theme";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isSameMonth(ts: number, ref: Date) {
  const d = new Date(ts);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

export default function FecharMesScreen() {
  const router = useRouter();
  const { orders, deleteOrder } = useOrders();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const now = useMemo(() => new Date(), []);
  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const monthOrders = useMemo(
    () => orders.filter((o) => isSameMonth(o.createdAt, now)),
    [orders, now]
  );

  // Seleciona todos os pedidos do mês assim que a lista carrega.
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (initialized || monthOrders.length === 0) return;
    setSelected(new Set(monthOrders.map((o) => o.id)));
    setInitialized(true);
  }, [initialized, monthOrders]);

  const allSelected = monthOrders.length > 0 && selected.size === monthOrders.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === monthOrders.length ? new Set() : new Set(monthOrders.map((o) => o.id))
    );
  };

  const summary = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>();
    let grandTotal = 0;
    for (const o of monthOrders) {
      if (!selected.has(o.id)) continue;
      const key = o.customerId ?? `name:${o.customerName.trim().toLowerCase()}`;
      const total = o.items.reduce((acc, l) => acc + l.unitPrice * l.qty, 0);
      grandTotal += total;
      const row = map.get(key);
      if (row) {
        row.count += 1;
        row.total += total;
      } else {
        map.set(key, { name: o.customerName, count: 1, total });
      }
    }
    const rows = [...map.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
    );
    return { rows, grandTotal };
  }, [monthOrders, selected]);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const ids = [...selected];
      for (const id of ids) {
        await deleteOrder(id);
      }
      setConfirmOpen(false);
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Fechar mês</Text>
          <Text style={styles.subtitle}>
            Pedidos de {monthLabel}. Os clientes cadastrados não são removidos.
          </Text>
        </View>

        {monthOrders.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.empty}>Nenhum pedido neste mês.</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.summaryHeaderRow}>
                <Text style={styles.sectionTitle}>Resumo por cliente</Text>
                <Pressable onPress={toggleAll} hitSlop={8}>
                  <Text style={styles.selectAll}>
                    {allSelected ? "Limpar seleção" : "Selecionar todos"}
                  </Text>
                </Pressable>
              </View>
              {summary.rows.length === 0 ? (
                <Text style={styles.empty}>Nenhum pedido selecionado.</Text>
              ) : (
                summary.rows.map((r, i) => (
                  <View key={`${r.name}-${i}`} style={styles.summaryRow}>
                    <Text style={styles.summaryName} numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text style={styles.summaryMeta}>
                      {r.count} {r.count === 1 ? "pedido" : "pedidos"} · {formatBRL(r.total)}
                    </Text>
                  </View>
                ))
              )}
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text style={styles.summaryTotalLabel}>Total selecionado</Text>
                <Text style={styles.summaryTotalValue}>{formatBRL(summary.grandTotal)}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Pedidos</Text>
              {monthOrders.map((o) => {
                const checked = selected.has(o.id);
                const total = o.items.reduce((acc, l) => acc + l.unitPrice * l.qty, 0);
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => toggle(o.id)}
                    style={({ pressed }) => [styles.orderRow, pressed && { opacity: 0.85 }]}
                  >
                    <Ionicons
                      name={checked ? "checkbox" : "square-outline"}
                      size={22}
                      color={checked ? colors.primary : colors.muted}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.orderName} numberOfLines={1}>
                        {o.customerName}
                      </Text>
                      <Text style={styles.orderMeta}>
                        {new Date(o.createdAt).toLocaleDateString("pt-BR")} · {formatBRL(total)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <PrimaryButton
              title={`Limpar ${selected.size} ${selected.size === 1 ? "pedido" : "pedidos"}`}
              variant="danger"
              onPress={() => setConfirmOpen(true)}
              disabled={selected.size === 0 || busy}
            />
          </>
        )}
      </ScrollView>

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Confirmar limpeza</Text>
            <Text style={styles.dialogText}>
              {selected.size} {selected.size === 1 ? "pedido será removido" : "pedidos serão removidos"}{" "}
              ({formatBRL(summary.grandTotal)}). Os clientes serão mantidos. Esta ação não pode ser
              desfeita.
            </Text>
            <View style={styles.dialogActions}>
              <PrimaryButton
                title="Cancelar"
                variant="ghost"
                onPress={() => setConfirmOpen(false)}
                disabled={busy}
                style={styles.dialogBtn}
              />
              <PrimaryButton
                title="Limpar"
                variant="danger"
                onPress={() => void handleConfirm()}
                loading={busy}
                disabled={busy}
                style={styles.dialogBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: space.lg,
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
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  subtitle: { marginTop: 6, color: colors.muted, fontSize: 14, lineHeight: 20 },
  empty: { color: colors.muted, fontSize: 14, paddingVertical: space.sm },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: space.sm,
  },
  summaryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectAll: { color: colors.primary, fontWeight: "700", fontSize: 13, marginBottom: space.sm },
  summaryRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.md,
    paddingVertical: 6,
  },
  summaryName: { fontSize: 14, color: colors.text, fontWeight: "600", flexShrink: 1 },
  summaryMeta: { fontSize: 13, color: colors.muted },
  summaryTotal: {
    marginTop: space.xs,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  summaryTotalLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
  summaryTotalValue: { fontSize: 16, fontWeight: "800", color: colors.text },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  orderName: { fontSize: 15, fontWeight: "700", color: colors.text },
  orderMeta: { marginTop: 2, fontSize: 13, color: colors.muted },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: space.lg,
    width: "100%",
    maxWidth: 420,
    gap: space.sm,
  },
  dialogTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  dialogText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  dialogActions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  dialogBtn: { flex: 1 },
});
