import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "../src/auth/authContext";
import { CustomersProvider } from "../src/customersContext";
import { OrdersProvider } from "../src/ordersContext";
import { ProductsProvider } from "../src/productsContext";
import { colors } from "../src/theme";

const screenOptions = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.bg },
  headerTitleStyle: { fontWeight: "700" as const, color: colors.text },
  headerTintColor: colors.text,
  contentStyle: { backgroundColor: colors.bg },
};

function AppShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) {
    return (
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack>
    );
  }

  return (
    <CustomersProvider>
      <ProductsProvider>
        <OrdersProvider>
          <Stack screenOptions={screenOptions}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="novo" options={{ title: "Novo pedido" }} />
            <Stack.Screen name="pedido/[id]" options={{ title: "Pedido" }} />
            <Stack.Screen name="cliente/novo" options={{ title: "Novo cliente" }} />
            <Stack.Screen name="cliente/[id]" options={{ title: "Cliente" }} />
            <Stack.Screen name="clientes/importar" options={{ title: "Importar clientes" }} />
            <Stack.Screen name="fechar-mes" options={{ title: "Fechar mês" }} />
          </Stack>
        </OrdersProvider>
      </ProductsProvider>
    </CustomersProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="dark" />
        <AppShell />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
