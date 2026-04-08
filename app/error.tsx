'use client';

import React, { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('PropSys Application Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-10 h-10 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Algo salió mal</h2>
          <p className="text-slate-500 font-medium text-sm">
            Ha ocurrido un error inesperado en la aplicación. Hemos notificado al equipo técnico.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl text-left overflow-auto max-h-40">
              <p className="text-[10px] font-mono text-rose-600 font-bold uppercase tracking-widest mb-1">Error Debug:</p>
              <p className="text-xs font-mono text-slate-600 break-all">{error.message}</p>
            </div>
          )}
        </div>

        <button
          onClick={() => reset()}
          className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-primary/25 transition-all active:scale-95"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  );
}
