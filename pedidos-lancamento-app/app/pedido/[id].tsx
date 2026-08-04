import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OrderForm } from "../../src/components/OrderForm";
import { toOrderLineInputs } from "../../src/domain/order";
import { useOrders } from "../../src/ordersContext";
import { ApiError } from "../../src/api/httpClient";
import { colors, space } from "../../src/theme";

export default function PedidoDetalheScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { orders, updateOrder, archiveOrder } = useOrders();
  const [busy, setBusy] = useState(false);

  const order = useMemo(() => orders.find((o) => o.id === id), [orders, id]);

  if (!order) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        <View style={styles.missing}>
          <Text style={styles.missingTitle}>Pedido não encontrado</Text>
          <Text style={styles.missingText}>Ele pode ter sido arquivado ou excluído.</Text>
          <Pressable onPress={() => router.replace("/")} accessibilityRole="link">
            <Text style={styles.link}>Voltar para a lista</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: order.customerName }} />
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        <View style={styles.wrap}>
          <OrderForm
            key={order.updatedAt}
            initial={{
              customerId: order.customerId,
              customerName: order.customerName,
              items: order.items,
              notes: order.notes,
            }}
            submitLabel="Salvar alterações"
            busy={busy}
            onSubmit={async (payload) => {
              setBusy(true);
              try {
                await updateOrder(order.id, {
                  customerId: payload.customerId,
                  items: toOrderLineInputs(payload.items),
                  notes: payload.notes,
                });
                router.back();
              } catch (e) {
                Alert.alert("Pedido", e instanceof ApiError ? e.message : "Não foi possível salvar.");
              } finally {
                setBusy(false);
              }
            }}
            onArchive={async () => {
              setBusy(true);
              try {
                await archiveOrder(order.id);
                router.replace("/");
              } catch (e) {
                Alert.alert("Pedido", e instanceof ApiError ? e.message : "Não foi possível arquivar.");
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { flex: 1 },
  missing: { flex: 1, padding: space.xl, justifyContent: "center", gap: space.sm },
  missingTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  missingText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  link: {
    marginTop: space.md,
    color: colors.primary,
    fontWeight: "800",
    fontSize: 15,
  },
});
