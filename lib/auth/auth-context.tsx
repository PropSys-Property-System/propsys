'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState, UserRole } from '../types';
import { MOCK_ADMIN, MOCK_RESIDENT, MOCK_STAFF } from '../mocks';

interface AuthContextType extends AuthState {
  login: (role: UserRole) => Promise<void>;
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
    // Simulamos carga de sesión desde localStorage
    const savedUser = localStorage.getItem('propsys_user');
    if (savedUser) {
      setState({
        user: JSON.parse(savedUser),
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = async (role: UserRole) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    // Simulamos delay de red
    await new Promise(resolve => setTimeout(resolve, 800));

    let user: User;
    switch (role) {
      case 'ADMIN': user = MOCK_ADMIN; break;
      case 'STAFF': user = MOCK_STAFF; break;
      case 'RESIDENT': user = MOCK_RESIDENT; break;
      default: user = MOCK_RESIDENT;
    }

    localStorage.setItem('propsys_user', JSON.stringify(user));
    setState({
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  };

  const logout = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    await new Promise(resolve => setTimeout(resolve, 500));
    localStorage.removeItem('propsys_user');
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
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
