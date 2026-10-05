'use client'

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  initError: boolean;
  retryAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  logout: () => Promise<void>;
  isDirector: boolean;
  isProjectHead: boolean;
  isEmployee: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_CHECK_TIMEOUT_MS = 8000;
const LOGIN_REQUEST_TIMEOUT_MS = 30000;

const isValidUser = (value: unknown): value is User => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<User>;
  return typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.email === 'string' &&
    (candidate.role === 'Employee' || candidate.role === 'Director' || candidate.role === 'Project Head');
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState(false);
  const authCheckRef = useRef<Promise<void> | null>(null);

  const checkAuth = (isRetry = false): Promise<void> => {
    if (authCheckRef.current) return authCheckRef.current;
    if (isRetry) setLoading(true);
    setInitError(false);

    const check = (async () => {
      let savedToken: string | null = null;
      let cachedUser: User | null = null;
      let controller: AbortController | null = null;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      try {
        if (typeof window !== 'undefined') {
          savedToken = localStorage.getItem('auth_token');
          const savedUserStr = localStorage.getItem('user');
          if (savedUserStr) {
            try {
              const parsedUser: unknown = JSON.parse(savedUserStr);
              if (isValidUser(parsedUser)) {
                cachedUser = parsedUser;
              } else {
                localStorage.removeItem('user');
              }
            } catch {
              localStorage.removeItem('user');
            }
          }
        }

        if (!savedToken) {
          setUser(null);
          setToken(null);
          if (typeof window !== 'undefined') localStorage.removeItem('user');
          setLoading(false);
          return;
        }

        if (cachedUser) {
          setUser(cachedUser);
          setToken(savedToken);
          setLoading(false);
        } else {
          setToken(savedToken);
        }

        controller = new AbortController();
        timeoutId = setTimeout(() => controller?.abort(), AUTH_CHECK_TIMEOUT_MS);
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${savedToken}` },
          signal: controller.signal
        });

        if (res.status === 401 || res.status === 403) {
          setUser(null);
          setToken(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('user');
            localStorage.removeItem('auth_token');
          }
          return;
        }
        if (!res.ok) throw new Error(`Session verification failed (HTTP ${res.status}).`);

        const data: { user?: unknown } = await res.json();
        if (!isValidUser(data.user)) throw new Error('Session verification returned an invalid user.');

        setUser(data.user);
        setToken(savedToken);
        if (typeof window !== 'undefined') localStorage.setItem('user', JSON.stringify(data.user));
      } catch (error) {
        console.warn('Auth session verification failed:', error);
        setInitError(true);
        if (!cachedUser) {
          setUser(null);
          setToken(savedToken);
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        setLoading(false);
      }
    })();

    authCheckRef.current = check;
    void check.finally(() => {
      if (authCheckRef.current === check) authCheckRef.current = null;
    });
    return check;
  };

  useEffect(() => {
    void checkAuth();
    const failSafe = setTimeout(() => setLoading(false), AUTH_CHECK_TIMEOUT_MS + 500);
    return () => clearTimeout(failSafe);
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOGIN_REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }
      if (!isValidUser(data.user)) {
        return { success: false, error: 'The server returned an invalid user session.' };
      }

      setUser(data.user);
      if (data.token) {
        setToken(data.token);
        localStorage.setItem('auth_token', data.token);
      }
      localStorage.setItem('user', JSON.stringify(data.user));
      setInitError(false);
      return { success: true, user: data.user };
    } catch (err: any) {
      console.error('Login error:', err);
      return {
        success: false,
        error: err?.name === 'AbortError'
          ? 'Login request timed out. Please try again.'
          : 'Network error. Please try again.'
      };
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const logout = async (): Promise<void> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AUTH_CHECK_TIMEOUT_MS);
    try {
      await fetch('/api/auth/logout', { method: 'POST', signal: controller.signal });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      clearTimeout(timeoutId);
      setUser(null);
      setToken(null);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      setInitError(false);
    }
  };

  const isDirector = user?.role === 'Director';
  const isProjectHead = user?.role === 'Project Head';
  const isEmployee = user?.role === 'Employee';

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      initError,
      retryAuth: () => checkAuth(true),
      login,
      logout,
      isDirector,
      isProjectHead,
      isEmployee
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
