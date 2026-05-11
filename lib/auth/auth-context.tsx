'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from '../types';
import {
  clearAssignmentsCache,
  setAssignmentsCache,
  type CachedBuildingAssignment,
  type CachedUnitAssignment,
} from '@/lib/access/assignments-cache';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;
    const hydrate = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!isMounted) return;
        if (!res.ok) {
          setState({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        const data = (await res.json()) as {
          user: User;
          buildingAssignments?: CachedBuildingAssignment[];
          unitAssignments?: CachedUnitAssignment[];
        };
        if (data.user?.id && Array.isArray(data.buildingAssignments) && Array.isArray(data.unitAssignments)) {
          setAssignmentsCache(data.user.id, { buildingAssignments: data.buildingAssignments, unitAssignments: data.unitAssignments });
        }
        setState({ user: data.user, isAuthenticated: true, isLoading: false });
      } catch {
        if (!isMounted) return;
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    };
    hydrate();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      setState({ user: null, isAuthenticated: false, isLoading: false });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error || 'No se pudo iniciar sesión');
    }
    const me = await fetch('/api/auth/me', { credentials: 'include' });
    if (!me.ok) {
      setState({ user: null, isAuthenticated: false, isLoading: false });
      const data = (await me.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error || 'No se pudo iniciar sesión');
    }
    const data = (await me.json()) as {
      user: User;
      buildingAssignments?: CachedBuildingAssignment[];
      unitAssignments?: CachedUnitAssignment[];
    };
    if (data.user?.id && Array.isArray(data.buildingAssignments) && Array.isArray(data.unitAssignments)) {
      setAssignmentsCache(data.user.id, { buildingAssignments: data.buildingAssignments, unitAssignments: data.unitAssignments });
    }
    setState({ user: data.user, isAuthenticated: true, isLoading: false });
  };

  const logout = async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => null);
    if (state.user?.id) clearAssignmentsCache(state.user.id);
    setState({ user: null, isAuthenticated: false, isLoading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

