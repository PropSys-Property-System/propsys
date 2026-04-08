'use client';

import React from 'react';
import { RouteGuard } from '@/lib/auth/route-guard';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <RouteGuard allowedRoles={['STAFF']}>{children}</RouteGuard>;
}

