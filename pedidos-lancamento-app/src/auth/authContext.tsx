import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { remoteLogin, remoteMe } from "../api/authRemote";
import { ApiError, setSessionExpiredHandler } from "../api/httpClient";
import { clearTokens, loadTokens, loadUser, saveTokens, saveUser } from "./tokenStorage";
import type { AuthUser } from "../types";
import { markStartup } from "../utils/startupTiming";

type AuthContextValue = {
  user: AuthUser | null;
  /** `true` enquanto ainda não sabemos se há uma sessão válida salva. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    await clearTokens();
    setUser(null);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
  }, []);

  /**
   * Achado da auditoria de inicialização: antes, a tela ficava presa no
   * spinner até `remoteMe()` (rede) responder — em cold start do backend
   * (Render free tier "dormindo") isso podia demorar dezenas de segundos.
   * `loadTokens()`/`loadUser()` são só leitura local (SecureStore), então
   * liberamos a UI com o usuário salvo da última sessão IMEDIATAMENTE, e
   * confirmamos com o servidor em segundo plano, sem travar nada. Só
   * deslogamos se essa confirmação disser de verdade que a sessão não é mais
   * válida (401 depois do próprio `apiRequest` já ter tentado renovar o
   * token) — uma falha de rede/timeout na validação não desloga ninguém,
   * porque não é evidência de que a sessão expirou.
   */
  useEffect(() => {
    (async () => {
      const tokens = await loadTokens();
      if (!tokens) {
        setLoading(false);
        return;
      }

      const cachedUser = await loadUser();
      if (cachedUser) {
        setUser(cachedUser);
        setLoading(false);
      }

      try {
        const freshUser = await remoteMe();
        setUser(freshUser);
        await saveUser(freshUser);
        markStartup("auth_confirmed_background_ok");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          await clearTokens();
          setUser(null);
          markStartup("auth_confirmed_background_session_invalid");
        } else {
          // Rede/timeout/servidor fora do ar: mantém o usuário em cache — sem
          // conexão não há como confirmar nada mesmo, e isso não é evidência
          // de que a sessão expirou.
          markStartup("auth_confirmed_background_network_error");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await remoteLogin(email, password);
    await saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    await saveUser(result.user);
    setUser(result.user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
