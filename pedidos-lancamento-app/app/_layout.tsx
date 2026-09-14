import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, Barlow_700Bold } from "@expo-google-fonts/barlow";
import { BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold } from "@expo-google-fonts/barlow-condensed";
import * as Sentry from "@sentry/react-native";
import { useFonts } from "expo-font";
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
import { colors, fonts } from "../src/theme";
import type { AuthUser } from "../src/types";
import { markStartup } from "../src/utils/startupTiming";

// T1 do experimento de inicialização (ver relatório): primeiro código do app
// a rodar depois que o bundle JS foi avaliado — o mais próximo de "JS
// disponível" que dá pra observar sem instrumentação nativa.
markStartup("js_module_evaluated");

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
  headerTitleStyle: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
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

  // T3 do experimento: quando `loading` (autenticação) vira `false` — com a
  // renderização otimista de `AuthProvider`, isso deve acontecer quase na
  // hora quando já existe usuário em cache local, mesmo sem rede ainda.
  useEffect(() => {
    if (!loading) markStartup("auth_resolved_ui_unblocked");
  }, [loading]);

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
  // T2 do experimento: primeiro render da árvore React (efeitos rodam após o
  // commit inicial) — mede o tempo entre "JS avaliado" e "React de pé".
  useEffect(() => {
    markStartup("react_root_rendered");
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) markStartup("fonts_loaded");
  }, [fontsLoaded, fontError]);

  // Sem fontes ainda: não renderiza nada (splash nativa segue visível
  // sozinha até o primeiro commit) — é só um instante, carregando asset
  // local, não é o gargalo de rede que a auditoria de inicialização
  // resolveu em `authContext.tsx`. Sem `expo-splash-screen`: essa dependência
  // exige um ícone de splash nativo (Android 12+) que este projeto não tem —
  // quebrava o build sem trazer benefício real além do que este `return null` já dá.
  if (!fontsLoaded && !fontError) return null;

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
