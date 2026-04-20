import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { canAccessResidentApp } from '@/lib/auth/access-rules';
import { requireServerSessionUser } from '@/lib/server/auth/server-session';

export default async function ResidentLayout({ children }: { children: ReactNode }) {
  const user = await requireServerSessionUser('/resident/receipts');
  if (!canAccessResidentApp(user)) {
    redirect('/router');
  }
  return <>{children}</>;
}
