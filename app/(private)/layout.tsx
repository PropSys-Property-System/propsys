'use client';

import React from 'react';
import { AppShell } from "@/components/AppShell";
import { RouteGuard } from "@/lib/auth/route-guard";

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard>
      <AppShell>
        {children}
      </AppShell>
    </RouteGuard>
  );
}
