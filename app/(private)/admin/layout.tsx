'use client';

import React from 'react';
import { RouteGuard } from '@/lib/auth/route-guard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RouteGuard allowedRoles={['MANAGER', 'BUILDING_ADMIN']}>{children}</RouteGuard>;
}

