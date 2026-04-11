import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireServerSessionUser } from '@/lib/server/auth/server-session';

export default async function AdminUsersLayout({ children }: { children: ReactNode }) {
  const user = await requireServerSessionUser('/admin/users');
  if (user.role !== 'MANAGER') {
    redirect('/router');
  }
  return <>{children}</>;
}


