'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState(false);

  const checkAuth = async () => {
    try {
      const savedToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const savedUserStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;

      if (!savedToken) {
        setUser(null);
        setToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('user');
          localStorage.removeItem('auth_token');
        }
        setLoading(false);
        return;
      }

      if (savedUserStr) {
        try {
          const parsedUser = JSON.parse(savedUserStr);
          setUser(parsedUser);
          setToken(savedToken);
        } catch {
          setUser(null);
          setToken(null);
        }
      }

      // Verify token with backend
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${savedToken}` }
        });

        if (res.ok) {
          const data = await res.json();
          setUser(prev => {
            if (prev && JSON.stringify(prev) === JSON.stringify(data.user)) {
              return prev;
            }
            return data.user;
          });
          setToken(savedToken);
          if (typeof window !== 'undefined') {
            localStorage.setItem('user', JSON.stringify(data.user));
          }
        } else {
          // Invalid, expired, or inactive session -> clear user
          setUser(null);
          setToken(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('user');
            localStorage.removeItem('auth_token');
          }
        }
      } catch (e) {
        console.warn('Auth session verification failed:', e);
      }
    } catch (err: any) {
      console.error('Error verifying auth session:', err);
      setUser(null);
      setToken(null);
      setInitError(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
    // Safety fallback: guaranteed unblock loading state within 1 second
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(safetyTimer);
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' }
      }

      setUser(data.user)
      if (data.token) {
        setToken(data.token)
        localStorage.setItem('auth_token', data.token)
      }
      localStorage.setItem('user', JSON.stringify(data.user))
      setInitError(false)
      return { success: true, user: data.user }
    } catch (err: any) {
      console.error('Login error:', err)
      return { success: false, error: 'Network error. Please try again.' }
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      setUser(null)
      setToken(null)
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
      setInitError(false)
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
      retryAuth: checkAuth,
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
