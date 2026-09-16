import { getApiBaseUrl } from "../config";
import { clearTokens, loadTokens, saveAccessToken } from "../auth/tokenStorage";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Falha de rede/conexão, sem resposta do servidor — diferente de um erro que ele respondeu de propósito. */
export class NetworkError extends ApiError {
  constructor() {
    super(
      "Não foi possível falar com o servidor. Verifique se ele está ligado e se o celular está na mesma rede.",
      -1
    );
  }
}

/**
 * Distinto de `NetworkError`: aqui o `fetch` fica pendurado sem resposta até
 * estourar o tempo limite. Sem isso ele pode nunca resolver nem rejeitar,
 * travando pra sempre qualquer tela que dependa desse `await`.
 */
export class TimeoutError extends ApiError {
  constructor() {
    super("A operação demorou demais para responder. Verifique sua conexão e tente novamente.", -2);
  }
}

/** 15s: dá tempo pra requisição terminar mesmo em rede ruim (ex.: recalcular rota via Google Routes) sem travar o usuário indefinidamente. */
const REQUEST_TIMEOUT_MS = 15_000;

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
  // Mesmo risco de `fetch` travar que motivou o timeout em `doFetch` — essa chamada roda no mesmo fluxo.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(joinUrl(requireBaseUrl(), "/v1/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string };
    await saveAccessToken(data.accessToken);
    return data.accessToken;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** `false` só para o próprio login, que ainda não tem token. */
  auth?: boolean;
};

async function doFetch(base: string, path: string, options: RequestOptions, token: string | null) {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};
  // Só manda Content-Type quando há corpo — em requisições sem corpo (POST /start, /cancel...) isso faz o Fastify rejeitar com FST_ERR_CTP_EMPTY_JSON_BODY.
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  // AbortController dá um limite de tempo ao fetch — sem ele, uma conexão travada (comum em troca de torre no 4G) nunca resolve nem rejeita.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const res = await fetch(joinUrl(base, path), {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    console.log(`[API] ${method} ${path} -> ${res.status} (${Date.now() - startedAt}ms)`);
    return res;
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[API] ${method} ${path} -> timeout após ${elapsedMs}ms (limite: ${REQUEST_TIMEOUT_MS}ms)`);
      throw new TimeoutError();
    }
    // fetch rejeita sem resposta HTTP quando o servidor está fora do ar, o endereço está errado ou não há rede.
    console.error(`[API] ${method} ${path} -> falha de rede (servidor inalcançável) após ${elapsedMs}ms`, err);
    throw new NetworkError();
  } finally {
    clearTimeout(timeoutId);
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
    token = refreshed;
    res = await doFetch(base, path, options, token);
  }

  // Plano free do Render "dorme" o serviço após inatividade — a primeira requisição pode falhar (5xx) enquanto ele acorda; uma retry resolve a maioria dos casos.
  if (res.status >= 500) {
    console.warn(
      `[API] ${options.method ?? "GET"} ${path} -> ${res.status}, tentando novamente em 2s (serviço pode estar acordando)`
    );
    await new Promise((resolve) => setTimeout(resolve, 2000));
    res = await doFetch(base, path, options, token);
  }

  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const message = await readErrorMessage(res);
    console.error(`[API] ${options.method ?? "GET"} ${path} -> erro ${res.status}: ${message}`);
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}
