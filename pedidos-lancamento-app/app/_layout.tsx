import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CustomersProvider } from "../src/customersContext";
import { OrdersProvider } from "../src/ordersContext";
import { colors } from "../src/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <CustomersProvider>
        <OrdersProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.bg },
              headerTitleStyle: { fontWeight: "700", color: colors.text },
              headerTintColor: colors.text,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="novo" options={{ title: "Novo pedido" }} />
            <Stack.Screen name="pedido/[id]" options={{ title: "Pedido" }} />
            <Stack.Screen name="cliente/novo" options={{ title: "Novo cliente" }} />
            <Stack.Screen name="cliente/[id]" options={{ title: "Cliente" }} />
            <Stack.Screen name="clientes/importar" options={{ title: "Importar clientes" }} />
            <Stack.Screen name="fechar-mes" options={{ title: "Fechar mês" }} />
          </Stack>
        </OrdersProvider>
      </CustomersProvider>
    </GestureHandlerRootView>
  );
}
