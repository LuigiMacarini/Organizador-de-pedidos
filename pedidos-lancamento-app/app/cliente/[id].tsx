import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CustomerForm } from "../../src/components/CustomerForm";
import { useCustomers } from "../../src/customersContext";
import { ApiError } from "../../src/api/httpClient";
import { colors, space } from "../../src/theme";

export default function ClienteDetalheScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { customers, updateCustomer, deleteCustomer } = useCustomers();
  const [busy, setBusy] = useState(false);

  const customer = useMemo(() => customers.find((c) => c.id === id), [customers, id]);

  if (!customer) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        <View style={styles.missing}>
          <Text style={styles.missingTitle}>Cliente não encontrado</Text>
          <Text style={styles.missingText}>Ele pode ter sido excluído.</Text>
          <Pressable onPress={() => router.back()} accessibilityRole="link">
            <Text style={styles.link}>Voltar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: customer.name }} />
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        <View style={styles.wrap}>
          <CustomerForm
            key={customer.updatedAt}
            initial={{
              name: customer.name,
              phone: customer.phone,
              note: customer.note,
            }}
            submitLabel="Salvar alterações"
            busy={busy}
            onSubmit={async (payload) => {
              setBusy(true);
              try {
                await updateCustomer(customer.id, payload);
                router.back();
              } catch (e) {
                Alert.alert("Cliente", e instanceof ApiError ? e.message : "Não foi possível salvar.");
              } finally {
                setBusy(false);
              }
            }}
            onDelete={async () => {
              setBusy(true);
              try {
                await deleteCustomer(customer.id);
                router.back();
              } catch (e) {
                Alert.alert("Cliente", e instanceof ApiError ? e.message : "Não foi possível excluir.");
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
  link: { marginTop: space.md, color: colors.primary, fontWeight: "800", fontSize: 15 },
});
