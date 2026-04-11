import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireServerSessionUser } from '@/lib/server/auth/server-session';

export default async function ResidentUnitsLayout({ children }: { children: ReactNode }) {
  const user = await requireServerSessionUser('/resident/units');
  if (user.role !== 'OWNER') {
    redirect('/router');
  }
  return <>{children}</>;
}


