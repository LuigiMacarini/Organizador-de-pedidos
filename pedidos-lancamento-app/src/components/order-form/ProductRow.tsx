import React, { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Product } from "../../types";
import { colors, radii, space } from "../../theme";
import { formatBRL } from "../../utils/format";

const MAX_QTY = 1_000_000;

type Props = {
  product: Product;
  qty: number;
  onAdjust: (product: Product, delta: number) => void;
  onSetQty: (product: Product, qty: number) => void;
};

/**
 * Memoizado: com `onAdjust`/`onSetQty` estáveis (useCallback no pai) e `qty`
 * como número primitivo, cada linha só re-renderiza quando a própria
 * quantidade muda — não a lista inteira a cada tecla digitada em outro lugar.
 */
function ProductRowBase({ product, qty, onAdjust, onSetQty }: Props) {
  const handleChangeText = useCallback(
    (text: string) => {
      const digits = text.replace(/\D/g, "");
      if (digits === "") {
        onSetQty(product, 0);
        return;
      }
      onSetQty(product, Math.min(parseInt(digits, 10), MAX_QTY));
    },
    [product, onSetQty]
  );

  return (
    <View style={[styles.row, qty > 0 && styles.rowActive]}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.meta}>
          {product.sku ? `${product.sku} · ` : ""}
          {formatBRL(product.unitPrice)}
        </Text>
      </View>

      <View style={styles.qtyRow}>
        <Pressable
          onPress={() => onAdjust(product, -1)}
          disabled={qty === 0}
          hitSlop={6}
          style={({ pressed }) => [
            styles.qtyBtn,
            qty === 0 && styles.qtyBtnDisabled,
            pressed && qty > 0 && styles.qtyBtnPressed,
          ]}
          accessibilityLabel={`Diminuir quantidade de ${product.name}`}
        >
          <Text style={[styles.qtyBtnText, qty === 0 && styles.qtyBtnTextDisabled]}>−</Text>
        </Pressable>
        <TextInput
          value={qty === 0 ? "" : String(qty)}
          onChangeText={handleChangeText}
          placeholder="0"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          inputMode="numeric"
          selectTextOnFocus
          maxLength={8}
          style={styles.qtyInput}
          accessibilityLabel={`Quantidade de ${product.name}`}
        />
        <Pressable
          onPress={() => onAdjust(product, 1)}
          hitSlop={6}
          style={({ pressed }) => [styles.qtyBtn, pressed && styles.qtyBtnPressed]}
          accessibilityLabel={`Aumentar quantidade de ${product.name}`}
        >
          <Text style={styles.qtyBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const ProductRow = memo(ProductRowBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    borderLeftWidth: 2,
    borderLeftColor: "transparent",
    backgroundColor: colors.surface,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  rowActive: {
    borderLeftColor: colors.primary,
  },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: "600", color: colors.text },
  meta: { marginTop: 2, fontSize: 12, color: colors.muted },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnPressed: { backgroundColor: colors.bg },
  qtyBtnDisabled: { opacity: 0.4 },
  qtyBtnText: { fontSize: 18, fontWeight: "700", color: colors.text },
  qtyBtnTextDisabled: { color: colors.muted },
  qtyInput: {
    minWidth: 40,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
});
