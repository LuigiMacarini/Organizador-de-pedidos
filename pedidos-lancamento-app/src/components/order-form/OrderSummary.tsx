import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { LineItem } from "../../types";
import { colors, space } from "../../theme";
import { formatBRL } from "../../utils/format";
import { getOrderTotal } from "../../domain/order";

type Props = {
  customerName: string;
  items: LineItem[];
};

export function OrderSummary({ customerName, items }: Props) {
  const total = getOrderTotal(items);
  const units = items.reduce((acc, l) => acc + l.qty, 0);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Resumo do pedido</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Cliente</Text>
        <Text style={styles.value} numberOfLines={1}>
          {customerName.trim() || "—"}
        </Text>
      </View>

      <Text style={styles.section}>Produtos pedidos</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>Nenhum produto selecionado ainda.</Text>
      ) : (
        <View>
          {items.map((l) => (
            <View key={l.productId} style={styles.productRow}>
              <View style={{ flex: 1, paddingRight: space.sm }}>
                <Text style={styles.productName} numberOfLines={2}>
                  {l.name}
                </Text>
                <Text style={styles.productMeta}>
                  {formatBRL(l.unitPrice)} · {l.qty} {l.qty === 1 ? "unidade" : "unidades"}
                </Text>
              </View>
              <Text style={styles.productSub}>{formatBRL(l.unitPrice * l.qty)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.row}>
        <Text style={styles.label}>Tipos de produto</Text>
        <Text style={styles.value}>{items.length}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Unidades no total</Text>
        <Text style={styles.value}>{units}</Text>
      </View>
      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.totalLabel}>Total estimado</Text>
        <Text style={styles.totalValue}>{formatBRL(total)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  title: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: space.sm,
  },
  section: {
    marginTop: space.md,
    marginBottom: space.xs,
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  empty: { color: colors.muted, fontSize: 14, marginBottom: space.sm },
  productRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  productName: { fontSize: 14, fontWeight: "600", color: colors.text },
  productMeta: { marginTop: 2, fontSize: 12, color: colors.muted },
  productSub: { fontSize: 14, fontWeight: "700", color: colors.text },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: space.md,
    paddingVertical: 6,
  },
  label: { color: colors.muted, fontSize: 14 },
  value: { color: colors.text, fontSize: 14, fontWeight: "600", flexShrink: 1 },
  totalRow: {
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { color: colors.text, fontSize: 15, fontWeight: "700" },
  totalValue: { color: colors.text, fontSize: 17, fontWeight: "800" },
});
