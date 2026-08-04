import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { remoteLogin, remoteMe } from "../api/authRemote";
import { setSessionExpiredHandler } from "../api/httpClient";
import { clearTokens, loadTokens, saveTokens } from "./tokenStorage";
import type { AuthUser } from "../types";

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

  useEffect(() => {
    (async () => {
      const tokens = await loadTokens();
      if (!tokens) {
        setLoading(false);
        return;
      }
      try {
        setUser(await remoteMe());
      } catch {
        await clearTokens();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await remoteLogin(email, password);
    await saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
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
