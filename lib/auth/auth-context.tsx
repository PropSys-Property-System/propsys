'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState, UserRole } from '../types';
import { MOCK_BUILDING_ADMIN, MOCK_MANAGER, MOCK_OWNER, MOCK_STAFF, MOCK_TENANT, MOCK_ROOT_ADMIN } from '../mocks';
import { auditService } from '../audit/audit-service';
import { mapInternalRoleToUIRole } from './role-mapping';

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
    const savedUserJson = localStorage.getItem('propsys_user');
    if (savedUserJson) {
      const storedUser = JSON.parse(savedUserJson) as User;
      
      // Derivamos el UI role dinámicamente sin mutar el objeto original (inmortalidad del mock)
      const user: User = {
        ...storedUser,
        role: mapInternalRoleToUIRole(storedUser.internalRole)
      };
      
      setState({
        user,
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

    let mockUser: User;
    switch (role) {
      case 'MANAGER': mockUser = MOCK_MANAGER; break; // Podría ser ROOT_ADMIN según el email
      case 'BUILDING_ADMIN': mockUser = MOCK_BUILDING_ADMIN; break;
      case 'STAFF': mockUser = MOCK_STAFF; break;
      case 'OWNER': mockUser = MOCK_OWNER; break;
      case 'TENANT': mockUser = MOCK_TENANT; break;
      default: mockUser = MOCK_TENANT;
    }

    // Clonamos y derivamos el role UI dinámicamente
    const user: User = {
      ...mockUser,
      role: mapInternalRoleToUIRole(mockUser.internalRole)
    };

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
