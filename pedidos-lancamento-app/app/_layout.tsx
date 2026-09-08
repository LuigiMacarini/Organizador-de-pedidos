import * as Sentry from "@sentry/react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "../src/auth/authContext";
import { CustomersProvider } from "../src/customersContext";
import { OrdersProvider } from "../src/ordersContext";
import { ProductsProvider } from "../src/productsContext";
import { RoutesProvider } from "../src/routesContext";
import { colors } from "../src/theme";
import type { AuthUser } from "../src/types";

/**
 * 100% de amostragem (tracing + profiling) — deliberado, é a janela de
 * coleta do estudo de performance do TCC (ver protocolo). Reduzir depois
 * que o experimento acabar, para não gastar quota à toa em uso normal.
 * Sem DSN (ex.: build sem a variável configurada), o SDK só fica inativo,
 * não quebra o app.
 */
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  enableAppStartTracking: true,
  enableNativeFramesTracking: true,
});

const screenOptions = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.bg },
  headerTitleStyle: { fontWeight: "700" as const, color: colors.text },
  headerTintColor: colors.text,
  contentStyle: { backgroundColor: colors.bg },
};

/**
 * Todas as telas ficam sempre declaradas no Stack — no Expo Router v4,
 * remover uma tela condicionalmente não impede o roteador de tentar
 * resolver a URL atual para ela (quebra fora dos Providers). Em vez disso,
 * redirecionamos com base no segmento da rota atual.
 */
function useProtectedRoute(user: AuthUser | null, loading: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inLoginScreen = segments[0] === "login";
    if (!user && !inLoginScreen) {
      router.replace("/login");
    } else if (user && inLoginScreen) {
      router.replace("/");
    }
  }, [user, loading, segments, router]);
}

function AppShell() {
  const { user, loading } = useAuth();
  useProtectedRoute(user, loading);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <CustomersProvider>
      <ProductsProvider>
        <OrdersProvider>
          <RoutesProvider>
            <Stack screenOptions={screenOptions}>
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="novo" options={{ title: "Novo pedido" }} />
              <Stack.Screen name="pedido/[id]" options={{ title: "Pedido" }} />
              <Stack.Screen name="cliente/novo" options={{ title: "Novo cliente" }} />
              <Stack.Screen name="cliente/[id]" options={{ title: "Cliente" }} />
              <Stack.Screen name="clientes/importar" options={{ title: "Importar clientes" }} />
              <Stack.Screen name="fechar-mes" options={{ title: "Fechar mês" }} />
              <Stack.Screen name="rota/nova" options={{ title: "Nova rota" }} />
              <Stack.Screen name="rota/[id]" options={{ title: "Rota" }} />
            </Stack>
          </RoutesProvider>
        </OrdersProvider>
      </ProductsProvider>
    </CustomersProvider>
  );
}

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="dark" />
        <AppShell />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
