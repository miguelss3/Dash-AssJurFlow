import { useEffect, useState, useCallback } from "react";

export interface AuthUser {
  posto: string;
  nome: string;
  role: string;
  secao: string;
}

const STORAGE_KEY = "assjur:auth";

function readStored(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/**
 * Auth mock baseado em localStorage. Substituir por Lovable Cloud futuramente.
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(readStored());
    setReady(true);
  }, []);

  const login = useCallback((u: AuthUser) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return { user, ready, login, logout, isAuthenticated: !!user };
}
