import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { canAccessAdminApp } from '@/lib/auth/access-rules';
import { requireServerSessionUser } from '@/lib/server/auth/server-session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireServerSessionUser('/admin/dashboard');
  if (!canAccessAdminApp(user)) {
    redirect('/router');
  }
  return <>{children}</>;
}
