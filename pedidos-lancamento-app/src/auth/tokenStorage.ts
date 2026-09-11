import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { AuthUser } from "../types";

const ACCESS_KEY = "pedidos.accessToken";
const REFRESH_KEY = "pedidos.refreshToken";
const USER_KEY = "pedidos.user";

/**
 * No nativo usamos o keychain/keystore criptografado (`expo-secure-store`).
 * Na web não existe equivalente — `expo-secure-store` nem funciona lá —
 * então caímos para `localStorage`. Aceitável aqui porque o app web é só
 * para desenvolvimento/demonstração; o uso real é no celular.
 */
const isWeb = Platform.OS === "web";

async function getItem(key: string): Promise<string | null> {
  if (isWeb) return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export type TokenPair = { accessToken: string; refreshToken: string };

export async function loadTokens(): Promise<TokenPair | null> {
  const [accessToken, refreshToken] = await Promise.all([
    getItem(ACCESS_KEY),
    getItem(REFRESH_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function saveTokens(tokens: TokenPair): Promise<void> {
  await Promise.all([
    setItem(ACCESS_KEY, tokens.accessToken),
    setItem(REFRESH_KEY, tokens.refreshToken),
  ]);
}

export async function saveAccessToken(accessToken: string): Promise<void> {
  await setItem(ACCESS_KEY, accessToken);
}

/**
 * Cópia local do usuário logado — só para renderizar a UI imediatamente na
 * abertura do app sem esperar rede (ver `AuthProvider`). Não é fonte de
 * verdade: `remoteMe()` sempre roda em seguida, em segundo plano, pra
 * confirmar/atualizar esses dados contra o servidor.
 */
export async function saveUser(user: AuthUser): Promise<void> {
  await setItem(USER_KEY, JSON.stringify(user));
}

export async function loadUser(): Promise<AuthUser | null> {
  const raw = await getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await Promise.all([deleteItem(ACCESS_KEY), deleteItem(REFRESH_KEY), deleteItem(USER_KEY)]);
}
