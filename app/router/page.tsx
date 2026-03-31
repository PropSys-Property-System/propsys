'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Loader2 } from 'lucide-react';

export default function RouterPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Simulamos un pequeño delay para mostrar el loader del router
    const timeout = setTimeout(() => {
      if (!isAuthenticated) {
        router.push('/');
        return;
      }

      if (user) {
        // Redirección inteligente basada en rol
        if (user.role === 'MANAGER' || user.role === 'BUILDING_ADMIN') {
          router.push('/admin/dashboard');
        } else if (user.role === 'STAFF') {
          router.push('/staff/tasks');
        } else if (user.role === 'OWNER' || user.role === 'TENANT') {
          router.push('/resident/receipts');
        } else {
          // Si por alguna razón no tiene rol definido, setup
          router.push('/setup');
        }
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [user, isAuthenticated, isLoading, router]);

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
      
      {/* Branding minimalista abajo */}
      <div className="absolute bottom-12">
        <span className="text-xs font-black text-slate-300 uppercase tracking-[0.3em]">PropSys</span>
      </div>
    </div>
  );
}
