'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';

const PASSWORD_ERROR =
  'La contraseña debe tener al menos 12 caracteres, mayúscula, minúscula, número, símbolo y no debe tener espacios.';
const GENERIC_ERROR = 'No pudimos activar la cuenta. Revisa el enlace o solicita una nueva invitación.';

type InvitationAcceptViewProps = {
  token: string;
};

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 12 &&
    !/\s/.test(password) &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export function InvitationAcceptView({ token }: InvitationAcceptViewProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const trimmedToken = token.trim();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!isStrongPassword(password)) {
      setError(PASSWORD_ERROR);
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/invitations/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: trimmedToken, password }),
      });

      if (!res.ok) {
        setError(GENERIC_ERROR);
        return;
      }

      setIsSuccess(true);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-md bg-white p-10 shadow-2xl rounded-3xl border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-primary" />
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Activar cuenta</h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">Define tu contraseña para entrar a PropSys.</p>
        </div>

        {!trimmedToken ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-center text-sm font-bold text-red-700">
            Invitación inválida o incompleta.
          </div>
        ) : isSuccess ? (
          <div className="text-center space-y-8">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            </div>
            <p className="text-slate-700 font-bold">Cuenta activada correctamente. Ya puedes iniciar sesión.</p>
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-6 py-4 text-sm font-black text-white shadow-xl shadow-primary/20 transition hover:bg-primary/90"
            >
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="password" className="text-xs font-black uppercase tracking-widest text-slate-500">
                Contraseña
              </label>
              <div className="relative">
                <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-4 pl-12 pr-4 text-sm font-bold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-xs font-black uppercase tracking-widest text-slate-500">
                Confirmar contraseña
              </label>
              <div className="relative">
                <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-4 pl-12 pr-4 text-sm font-bold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>

            <p className="text-xs font-medium leading-relaxed text-slate-500">
              Usa al menos 12 caracteres con mayúscula, minúscula, número y símbolo. No uses espacios.
            </p>

            {error ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center rounded-2xl bg-primary px-6 py-4 text-sm font-black text-white shadow-xl shadow-primary/25 transition hover:bg-primary/90 disabled:opacity-70"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Activar cuenta'}
            </button>
          </form>
        )}
      </section>
      <div className="mt-12 text-center">
        <span className="text-xs font-black text-slate-300 uppercase tracking-[0.4em]">PropSys</span>
      </div>
    </main>
  );
}
