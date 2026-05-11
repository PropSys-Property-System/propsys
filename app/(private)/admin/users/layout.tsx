import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { canAccessPortfolioAdminApp } from '@/lib/auth/access-rules';
import { requireServerSessionUser } from '@/lib/server/auth/server-session';

export default async function AdminUsersLayout({ children }: { children: ReactNode }) {
  const user = await requireServerSessionUser('/admin/users');
  if (!canAccessPortfolioAdminApp(user)) {
    redirect('/router');
  }
  return <>{children}</>;
}
