import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OrderForm } from "../src/components/OrderForm";
import { useOrders } from "../src/ordersContext";
import { colors, space } from "../src/theme";

export default function NovoPedidoScreen() {
  const router = useRouter();
  const { createOrder } = useOrders();
  const [busy, setBusy] = useState(false);

  return (
    <>
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
                  customerName: payload.customerName,
                  items: payload.items,
                  notes: payload.notes,
                });
                router.replace("/");
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
});
