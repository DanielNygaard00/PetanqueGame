// client/src/auth/AuthContext.tsx
import { createContext, useContext, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { getToken, setToken, clearToken } from "../api/client";
import type { AuthResponse } from "../api/types";

type User = { id: string; username: string } | null;
type AuthValue = {
  user: User;
  isAuthenticated: boolean;
  login: (username: string, password?: string) => Promise<void>;
  signup: (username: string, password?: string, email?: string, code?: string) => Promise<void>;
  logout: () => void;
};

const AuthCtx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);

  async function authenticate(path: string, payload: object) {
    const { data } = await api.post<AuthResponse>(path, payload);
    setToken(data.token);
    setUser(data.user);
  }

  const value: AuthValue = {
    user,
    isAuthenticated: !!user || !!getToken(),
    login: (username, password) => authenticate("/auth/login", { username, password }),
    signup: (username, password, email, code) => authenticate("/auth/signup", { username, password, email, code }),
    logout: () => { clearToken(); setUser(null); },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
