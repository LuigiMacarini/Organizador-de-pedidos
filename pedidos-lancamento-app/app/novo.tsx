import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OrderForm } from "../src/components/OrderForm";
import { toOrderLineInputs } from "../src/domain/order";
import { useOrders } from "../src/ordersContext";
import { ApiError } from "../src/api/httpClient";
import { colors } from "../src/theme";

export default function NovoPedidoScreen() {
  const router = useRouter();
  const { createOrder } = useOrders();
  const [busy, setBusy] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <View style={styles.wrap}>
        <OrderForm
          submitLabel="Finalizar lançamento"
          busy={busy}
          onSubmit={async (payload) => {
            setBusy(true);
            try {
              await createOrder({
                customerId: payload.customerId,
                items: toOrderLineInputs(payload.items),
                notes: payload.notes,
              });
              router.replace("/");
            } catch (e) {
              Alert.alert("Pedido", e instanceof ApiError ? e.message : "Não foi possível salvar.");
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { flex: 1 },
});
