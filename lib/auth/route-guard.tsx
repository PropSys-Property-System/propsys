'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './auth-context';
import { getDefaultRouteForUser } from './access-rules';
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
      if (pathname !== '/' && pathname !== '/reset-password') {
        router.push('/');
      }
    } else if (user && allowedRoles && !allowedRoles.includes(user.role)) {
      router.push(getDefaultRouteForUser(user));
    }
  }, [user, isAuthenticated, isLoading, router, pathname, allowedRoles]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated && pathname !== '/' && pathname !== '/reset-password') {
    return null;
  }

  if (isAuthenticated && user && allowedRoles && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
