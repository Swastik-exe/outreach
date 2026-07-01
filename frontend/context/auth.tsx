'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api, tokenStore } from '@/lib/api';
import { isPlatformAdmin as checkAdmin, roleFromToken } from '@/lib/jwt';
import type { LoginRequest, RegisterRequest, TokenResponse } from '@/lib/types';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  role: string;
  isPlatformAdmin: boolean;
}

interface AuthContextValue extends AuthState {
  login: (req: LoginRequest) => Promise<{ error?: string }>;
  register: (req: RegisterRequest) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function syncRoleFromToken(): Pick<AuthState, 'role' | 'isPlatformAdmin'> {
  const token = tokenStore.get();
  const role = token ? roleFromToken(token) : 'USER';
  return { role, isPlatformAdmin: checkAdmin(token) };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    role: 'USER',
    isPlatformAdmin: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1'}/auth/refresh`,
          { method: 'POST', credentials: 'include' }
        );
        if (res.ok) {
          const body = await res.json() as { success: boolean; data?: TokenResponse };
          if (body.success && body.data?.accessToken) {
            tokenStore.set(body.data.accessToken);
            const roleInfo = syncRoleFromToken();
            setState({
              isAuthenticated: true,
              isLoading: false,
              role: body.data.role ?? roleInfo.role,
              isPlatformAdmin: (body.data.role ?? roleInfo.role) === 'PLATFORM_ADMIN',
            });
            return;
          }
        }
      } catch {
        // logged out
      }
      setState({
        isAuthenticated: false,
        isLoading: false,
        role: 'USER',
        isPlatformAdmin: false,
      });
    })();
  }, []);

  const login = useCallback(async (req: LoginRequest) => {
    const res = await api.post<TokenResponse>('/auth/login', req);
    if (res.success && res.data?.accessToken) {
      tokenStore.set(res.data.accessToken);
      const role = res.data.role ?? roleFromToken(res.data.accessToken);
      setState({
        isAuthenticated: true,
        isLoading: false,
        role,
        isPlatformAdmin: role === 'PLATFORM_ADMIN',
      });
      return {};
    }
    return { error: res.error ?? 'Login failed' };
  }, []);

  const register = useCallback(async (req: RegisterRequest) => {
    const res = await api.post<void>('/auth/register', req);
    if (res.success) return {};
    return { error: res.error ?? 'Registration failed' };
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    tokenStore.clear();
    setState({
      isAuthenticated: false,
      isLoading: false,
      role: 'USER',
      isPlatformAdmin: false,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
