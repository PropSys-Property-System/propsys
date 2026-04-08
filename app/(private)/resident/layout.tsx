'use client';

import React from 'react';
import { RouteGuard } from '@/lib/auth/route-guard';

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return <RouteGuard allowedRoles={['OWNER', 'TENANT']}>{children}</RouteGuard>;
}

