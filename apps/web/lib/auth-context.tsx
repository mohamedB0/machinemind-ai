"use client";
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { authApi, User } from "@/lib/api";

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("mm_token") : null
  );
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearToken = useCallback(() => {
    localStorage.removeItem("mm_token");
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!token) {
      queueMicrotask(() => setIsLoading(false));
      return;
    }
    let active = true;
    authApi.me(token)
      .then(me => { if (active) setUser(me); })
      .catch(() => { if (active) clearToken(); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [token, clearToken]);

  const login = async (email: string, password: string) => {
    const { access_token } = await authApi.login(email, password);
    localStorage.setItem("mm_token", access_token);
    setToken(access_token);
    const me = await authApi.me(access_token);
    setUser(me);
  };

  const logout = () => {
    clearToken();
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
