import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CustomerForm } from "../../src/components/CustomerForm";
import { useCustomers } from "../../src/customersContext";
import { colors } from "../../src/theme";

export default function NovoClienteScreen() {
  const router = useRouter();
  const { createCustomer, findByName } = useCustomers();
  const [busy, setBusy] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <View style={styles.wrap}>
        <CustomerForm
          submitLabel="Salvar cliente"
          busy={busy}
          onSubmit={async (payload) => {
            setBusy(true);
            try {
              if (findByName(payload.name)) {
                Alert.alert("Cliente", "Já existe um cliente com esse nome.");
                return;
              }
              await createCustomer(payload);
              router.back();
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
