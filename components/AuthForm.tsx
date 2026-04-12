'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { Mail, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';

export function AuthForm() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    }
  };

  return (
    <div className="w-full max-w-md p-8 bg-white shadow-2xl rounded-3xl border border-slate-100 transition-all duration-500">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
          <ShieldCheck className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">PropSys</h2>
        <p className="text-slate-500 mt-2 text-sm font-medium">
          Bienvenido de nuevo a tu gestión inmobiliaria
        </p>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl flex items-center"
        >
          <span className="mr-2">⚠️</span> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
              type="email"
              placeholder="Correo electrónico"
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-medium"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative group">
            <input
              type="password"
              placeholder="Contraseña"
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-medium"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-primary/25 flex items-center justify-center space-x-3 transition-all active:scale-[0.98] disabled:opacity-70 group"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>Entrar ahora</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>
      
      <div className="mt-10 text-center border-t border-slate-100 pt-8 flex flex-col space-y-3">
        <span className="text-xs font-bold text-slate-400">
          Si no tienes acceso, solicita credenciales a administracion.
        </span>
      </div>
    </div>
  );
}
