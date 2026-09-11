import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { remoteGetOrder } from "../api/ordersRemote";
import { getOrderTotal } from "../domain/order";
import { useRoutes } from "../routesContext";
import { colors, radii, space } from "../theme";
import type { Order } from "../types";
import { formatBRL } from "../utils/format";

type Props = {
  /** `null` = modal fechada. Mudar o id dispara um novo GET (com cache por id, dentro da sessão da tela). */
  orderId: string | null;
  /** Endereço já disponível localmente (vem da entrega, não do pedido) — evita um fetch de cliente à parte. */
  address?: string | null;
  onClose: () => void;
};

/**
 * Consulta simples do pedido de uma entrega — só leitura, nenhuma ação aqui
 * altera rota/entrega/pedido. Primeiro tenta o cache compartilhado de
 * `RoutesProvider` (pré-carregado ao iniciar a rota, funciona sem internet);
 * só cai para `GET /v1/orders/:id` em cache miss — pedido de uma rota que
 * ainda não foi iniciada, ou falha pontual no pré-carregamento. Mantém
 * também um cache local (dura enquanto a modal está montada) para não
 * repetir esse GET de fallback ao reabrir a mesma entrega na sessão.
 */
export function OrderDetailsModal({ orderId, address, onClose }: Props) {
  const { getCachedOrder } = useRoutes();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, Order>>(new Map());

  useEffect(() => {
    if (!orderId) return;

    const preloaded = getCachedOrder(orderId);
    if (preloaded) {
      setOrder(preloaded);
      setError(null);
      setLoading(false);
      return;
    }

    const cached = cacheRef.current.get(orderId);
    if (cached) {
      setOrder(cached);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setOrder(null);
    setError(null);
    setLoading(true);

    remoteGetOrder(orderId)
      .then((data) => {
        if (cancelled) return;
        cacheRef.current.set(orderId, data);
        setOrder(data);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar os dados do pedido. Tente novamente.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orderId, getCachedOrder]);

  return (
    <Modal visible={orderId !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Detalhes do pedido</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Fechar">
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {loading ? (
              <View style={styles.centerState}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.stateText}>Carregando pedido...</Text>
              </View>
            ) : error ? (
              <View style={styles.centerState}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : order ? (
              <>
                <View style={styles.block}>
                  <Text style={styles.blockLabel}>Cliente</Text>
                  <Text style={styles.blockValue}>{order.customerName}</Text>
                  {address ? <Text style={styles.addressText}>{address}</Text> : null}
                </View>

                <View style={styles.block}>
                  <Text style={styles.blockLabel}>Produtos</Text>
                  {order.items.map((item, index) => (
                    <View key={`${item.productId}-${index}`} style={styles.itemRow}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <View style={styles.itemMetaRow}>
                        <Text style={styles.itemMeta}>
                          {item.qty} × {formatBRL(item.unitPrice)}
                        </Text>
                        <Text style={styles.itemTotal}>{formatBRL(item.unitPrice * item.qty)}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {order.notes.trim() ? (
                  <View style={styles.block}>
                    <Text style={styles.blockLabel}>Observação</Text>
                    <Text style={styles.blockValue}>{order.notes}</Text>
                  </View>
                ) : null}

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total do pedido</Text>
                  <Text style={styles.totalValue}>{formatBRL(getOrderTotal(order.items))}</Text>
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 17, 21, 0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    maxHeight: "80%",
    gap: space.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  content: { gap: space.md, paddingBottom: space.md },
  centerState: { alignItems: "center", justifyContent: "center", gap: space.sm, paddingVertical: space.xl },
  stateText: { color: colors.muted, fontSize: 14 },
  errorText: { color: colors.danger, fontSize: 14, textAlign: "center", lineHeight: 20 },
  block: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: 4,
  },
  blockLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  blockValue: { fontSize: 15, color: colors.text, fontWeight: "600" },
  addressText: { fontSize: 14, color: colors.muted, lineHeight: 20, marginTop: 2 },
  itemRow: {
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 2,
  },
  itemName: { fontSize: 15, fontWeight: "600", color: colors.text },
  itemMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemMeta: { fontSize: 13, color: colors.muted },
  itemTotal: { fontSize: 14, fontWeight: "700", color: colors.text },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: space.md,
  },
  totalLabel: { fontSize: 13, fontWeight: "800", color: colors.text, textTransform: "uppercase", letterSpacing: 0.4 },
  totalValue: { fontSize: 20, fontWeight: "800", color: colors.primary },
});
