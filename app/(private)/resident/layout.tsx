import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireServerSessionUser } from '@/lib/server/auth/server-session';

export default async function ResidentLayout({ children }: { children: ReactNode }) {
  const user = await requireServerSessionUser('/resident/receipts');
  if (user.role !== 'OWNER' && user.role !== 'TENANT') {
    redirect('/router');
  }
  return <>{children}</>;
}


