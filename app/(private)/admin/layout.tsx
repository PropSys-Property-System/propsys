import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireServerSessionUser } from '@/lib/server/auth/server-session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireServerSessionUser('/admin/dashboard');
  if (user.role !== 'MANAGER' && user.role !== 'BUILDING_ADMIN') {
    redirect('/router');
  }
  return <>{children}</>;
}


