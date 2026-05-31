import React from 'react';
import { AppShell } from '@/components/AppShell';
import { getServerSessionUser } from '@/lib/server/auth/server-session';
import { loadNavigationBadges } from '@/lib/features/navigation/navigation-badges.data';

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSessionUser();
  const badgesByHref = user ? await loadNavigationBadges(user) : {};

  return <AppShell badgesByHref={badgesByHref}>{children}</AppShell>;
}

