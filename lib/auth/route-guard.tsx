'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './auth-context';
import { UserRole } from '../types';

interface RouteGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function RouteGuard({ children, allowedRoles }: RouteGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // Redirigir a login si no está autenticado y no está en una página pública
      if (pathname !== '/' && pathname !== '/reset-password') {
        router.push('/');
      }
    } else if (user) {
      // Si está autenticado, verificar roles
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirigir al dashboard correspondiente si no tiene permiso para la ruta actual
        if (user.role === 'ADMIN' || user.role === 'STAFF') {
          router.push('/admin/dashboard');
        } else {
          router.push('/resident/receipts');
        }
      }
    }
  }, [user, isAuthenticated, isLoading, router, pathname, allowedRoles]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Si no está autenticado y no es una ruta pública, no mostrar nada mientras redirige
  if (!isAuthenticated && pathname !== '/' && pathname !== '/reset-password') {
    return null;
  }

  // Si el rol no es permitido, no mostrar nada mientras redirige
  if (isAuthenticated && user && allowedRoles && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
