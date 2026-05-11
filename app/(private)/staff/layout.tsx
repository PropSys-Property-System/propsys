import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { canAccessStaffApp } from '@/lib/auth/access-rules';
import { requireServerSessionUser } from '@/lib/server/auth/server-session';

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const user = await requireServerSessionUser('/staff/tasks');
  if (!canAccessStaffApp(user)) {
    redirect('/router');
  }
  return <>{children}</>;
}
