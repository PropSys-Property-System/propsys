'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { getDefaultRouteForUser } from '@/lib/auth/access-rules';
import { Loader2 } from 'lucide-react';

function isValidNextPath(nextPath: string | null) {
  if (!nextPath) return false;
  if (!nextPath.startsWith('/')) return false;
  if (nextPath.startsWith('//')) return false;
  if (nextPath.startsWith('/api')) return false;
  if (nextPath.startsWith('/_next')) return false;
  return true;
}

function RouterPageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="relative">
        <div className="w-20 h-20 border-4 border-slate-100 rounded-full"></div>
        <div className="absolute inset-0 w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-pulse" />
        </div>
      </div>

      <div className="mt-8 text-center space-y-2">
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Preparando tu espacio</h2>
        <p className="text-sm text-slate-400 font-medium">Redirigiendo a tu panel de PropSys...</p>
      </div>

      <div className="absolute bottom-12">
        <span className="text-xs font-black text-slate-300 uppercase tracking-[0.3em]">PropSys</span>
      </div>
    </div>
  );
}

function RouterPageContent() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isLoading) return;

    // Simulamos un pequeño delay para mostrar el loader del router
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

