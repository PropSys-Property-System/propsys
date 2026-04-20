import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { canAccessResidentUnitsApp } from '@/lib/auth/access-rules';
import { requireServerSessionUser } from '@/lib/server/auth/server-session';

export default async function ResidentUnitsLayout({ children }: { children: ReactNode }) {
  const user = await requireServerSessionUser('/resident/units');
  if (!canAccessResidentUnitsApp(user)) {
    redirect('/router');
  }
  return <>{children}</>;
}
