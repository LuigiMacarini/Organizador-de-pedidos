import { getApiBaseUrl } from "../config";
import { clearTokens, loadTokens, saveAccessToken } from "../auth/tokenStorage";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** A requisição nem chegou a ter resposta do servidor (rede/servidor fora do ar) — distinto de um erro que o servidor respondeu de propósito (ex.: senha errada). */
export class NetworkError extends ApiError {
  constructor() {
    super(
      "Não foi possível falar com o servidor. Verifique se ele está ligado e se o celular está na mesma rede.",
      -1
    );
  }
}

/** Chamado pelo AuthProvider para reagir (redirecionar ao login) quando a sessão expira de vez. */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function requireBaseUrl(): string {
  const base = getApiBaseUrl();
  if (!base) {
    throw new ApiError(
      "Servidor não configurado. Defina EXPO_PUBLIC_API_URL no arquivo .env.",
      0
    );
  }
  return base;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return res.statusText;
    try {
      const json = JSON.parse(text) as { error?: string };
      return json.error ?? text;
    } catch {
      return text;
    }
  } catch {
    return res.statusText;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;
  try {
    const res = await fetch(joinUrl(requireBaseUrl(), "/v1/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string };
    await saveAccessToken(data.accessToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** `false` só para o próprio login, que ainda não tem token. */
  auth?: boolean;
};

async function doFetch(base: string, path: string, options: RequestOptions, token: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(joinUrl(base, path), {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // `fetch` rejeita (sem resposta HTTP nenhuma) quando o servidor está fora do ar,
    // o endereço está errado ou não há rede — diferente de um erro que o servidor
    // respondeu de propósito (ex.: 401 de senha errada).
    throw new NetworkError();
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const base = requireBaseUrl();
  const auth = options.auth ?? true;

  let token: string | null = null;
  if (auth) {
    const tokens = await loadTokens();
    if (!tokens) {
      onSessionExpired?.();
      throw new ApiError("Sessão expirada, faça login novamente", 401);
    }
    token = tokens.accessToken;
  }

  let res = await doFetch(base, path, options, token);

  if (auth && res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      await clearTokens();
      onSessionExpired?.();
      throw new ApiError("Sessão expirada, faça login novamente", 401);
    }
    res = await doFetch(base, path, options, refreshed);
  }

  if (res.status === 204) return undefined as T;
  if (!res.ok) throw new ApiError(await readErrorMessage(res), res.status);
  return (await res.json()) as T;
}
