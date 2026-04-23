'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { getDefaultRouteForUser } from '@/lib/auth/access-rules';
import { RouterPageLoader } from '@/lib/features/bootstrap/app-bootstrap.ui';

function isValidNextPath(nextPath: string | null) {
  if (!nextPath) return false;
  if (!nextPath.startsWith('/')) return false;
  if (nextPath.startsWith('//')) return false;
  if (nextPath.startsWith('/api')) return false;
  if (nextPath.startsWith('/_next')) return false;
  return true;
}

function RouterPageContent() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isLoading) return;

    const timeout = setTimeout(() => {
      if (!isAuthenticated) {
        router.push('/');
        return;
      }

      if (user) {
        const next = searchParams.get('next');
        if (next && isValidNextPath(next)) {
          router.push(next);
          return;
        }

        router.push(getDefaultRouteForUser(user));
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [user, isAuthenticated, isLoading, router, searchParams]);

  return <RouterPageLoader />;
}

export default function RouterPage() {
  return (
    <Suspense fallback={<RouterPageLoader />}>
      <RouterPageContent />
    </Suspense>
  );
}
