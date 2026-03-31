'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { UserRole } from '@/lib/types';
import { Mail, Lock, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export function AuthForm() {
  const { login, isLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [role, setRole] = useState<UserRole>('TENANT');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validación básica simulada
    if (mode === 'login') {
      if (!role) {
        setError('Por favor selecciona un perfil de acceso.');
        return;
      }
    } else {
      if (!email || !password) {
        setError('Por favor completa todos los campos.');
        return;
      }
    }

    try {
      await login(role);
    } catch {
      setError('Error al intentar acceder. Por favor intenta de nuevo.');
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
          {mode === 'login' ? 'Bienvenido de nuevo a tu gestión inmobiliaria' : 'Únete a la nueva era de administración'}
        </p>
      </div>

      {/* Toggle Login/Signup */}
      <div className="flex p-1 bg-slate-100 rounded-xl mb-8">
        <button
          onClick={() => setMode('login')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            mode === 'login' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Acceder
        </button>
        <button
          onClick={() => setMode('signup')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            mode === 'signup' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Registrarse
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl flex items-center">
          <span className="mr-2">⚠️</span> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {mode === 'login' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                Perfil de Prueba
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(['MANAGER', 'BUILDING_ADMIN', 'STAFF', 'OWNER', 'TENANT'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRole(r);
                      setEmail(
                        r === 'MANAGER'
                          ? 'manager@propsys.com'
                          : r === 'BUILDING_ADMIN'
                            ? 'building.admin@propsys.com'
                            : r === 'STAFF'
                              ? 'staff@propsys.com'
                              : r === 'OWNER'
                                ? 'owner@propsys.com'
                                : 'tenant@propsys.com'
                      );
                    }}
                    className={`px-3 py-2.5 text-[10px] font-black rounded-xl border-2 transition-all ${
                      role === r 
                        ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-[1.02]' 
                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <input
                type="email"
                placeholder="Correo electrónico"
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-medium"
                readOnly
                value={
                  email ||
                  (role === 'MANAGER'
                    ? 'manager@propsys.com'
                    : role === 'BUILDING_ADMIN'
                      ? 'building.admin@propsys.com'
                      : role === 'STAFF'
                        ? 'staff@propsys.com'
                        : role === 'OWNER'
                          ? 'owner@propsys.com'
                          : 'tenant@propsys.com')
                }
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <input
                type="email"
                placeholder="Tu correo electrónico"
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-medium"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <input
                type="password"
                placeholder="Crea una contraseña"
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-medium"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-primary/25 flex items-center justify-center space-x-3 transition-all active:scale-[0.98] disabled:opacity-70 group"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>{mode === 'login' ? 'Entrar ahora' : 'Crear mi cuenta'}</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>
      
      <div className="mt-10 text-center border-t border-slate-100 pt-8 flex flex-col space-y-3">
        <Link 
          href="/reset-password" 
          className="text-xs font-bold text-slate-400 hover:text-primary transition-colors"
        >
          ¿Olvidaste tu contraseña?
        </Link>
        {mode === 'login' && (
          <p className="text-[10px] text-slate-400 font-medium">
            ¿No tienes cuenta? <button onClick={() => setMode('signup')} className="text-primary font-bold hover:underline">Regístrate</button>
          </p>
        )}
      </div>
    </div>
  );
}
