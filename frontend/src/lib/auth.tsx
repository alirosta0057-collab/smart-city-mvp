"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api, type User, type UserRole } from "./api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (
    email: string,
    password: string,
    fullName: string,
    role: UserRole
  ) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "sc_token";

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

function homeForRole(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "agent":
      return "/agent";
    default:
      return "/citizen";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<User>("/api/auth/me");
      setUser(me);
    } catch {
      window.localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<LoginResponse>("/api/auth/login", {
      email,
      password,
    });
    window.localStorage.setItem(TOKEN_KEY, res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      role: UserRole
    ) => {
      const res = await api.post<LoginResponse>("/api/auth/register", {
        email,
        password,
        full_name: fullName,
        role,
      });
      window.localStorage.setItem(TOKEN_KEY, res.access_token);
      setUser(res.user);
      return res.user;
    },
    []
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function useRequireAuth(...roles: UserRole[]): {
  user: User | null;
  ready: boolean;
} {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (roles.length > 0 && !roles.includes(user.role)) {
      router.replace(homeForRole(user.role));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  return { user, ready: !loading && !!user };
}

export { homeForRole };
