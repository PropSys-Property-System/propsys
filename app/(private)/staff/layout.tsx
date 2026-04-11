import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireServerSessionUser } from '@/lib/server/auth/server-session';

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const user = await requireServerSessionUser('/staff/tasks');
  if (user.role !== 'STAFF') {
    redirect('/router');
  }
  return <>{children}</>;
}


