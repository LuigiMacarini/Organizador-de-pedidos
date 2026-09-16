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
   * Libera a UI com o usuário salvo localmente (SecureStore) sem esperar
   * rede, já que cold start do Render free tier pode levar dezenas de
   * segundos. `remoteMe()` confirma em segundo plano; só desloga se vier
   * 401 de verdade, nunca por falha de rede/timeout.
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
          // Rede/timeout: mantém o usuário em cache, isso não prova que a sessão expirou.
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
