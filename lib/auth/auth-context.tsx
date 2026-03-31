'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState, UserRole } from '../types';
import { MOCK_BUILDING_ADMIN, MOCK_MANAGER, MOCK_OWNER, MOCK_STAFF, MOCK_TENANT } from '../mocks';

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
      case 'MANAGER': user = MOCK_MANAGER; break;
      case 'BUILDING_ADMIN': user = MOCK_BUILDING_ADMIN; break;
      case 'STAFF': user = MOCK_STAFF; break;
      case 'OWNER': user = MOCK_OWNER; break;
      case 'TENANT': user = MOCK_TENANT; break;
      default: user = MOCK_TENANT;
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
