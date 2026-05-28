'use client';

import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';

const PASSWORD_ERROR =
  'La contraseña debe tener al menos 12 caracteres, mayuscula, minuscula, numero, simbolo y no debe tener espacios.';
const CONFIRM_ERROR = 'No pudimos restablecer la contraseña. Solicita un nuevo enlace.';
const REQUEST_SUCCESS = 'Si el correo existe, recibiras instrucciones para restablecer tu contraseña.';
const PROVIDER_ERROR =
  'No hay proveedor de correo configurado para enviar enlaces de recuperacion. Reemplaza re_xxxxxxxxx por tu API key real de Resend.';

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

function shellTitle(mode: 'request' | 'confirm') {
  return mode === 'request' ? 'Restablecer contraseña' : 'Actualizar contraseña';
}

export function PasswordResetShell({ children, mode }: { children: ReactNode; mode: 'request' | 'confirm' }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-md bg-white p-10 shadow-2xl rounded-3xl border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-primary" />
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{shellTitle(mode)}</h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">PropSys - Seguridad de cuenta</p>
        </div>

        {children}
      </section>

      <div className="mt-12 text-center">
        <span className="text-xs font-black text-slate-300 uppercase tracking-[0.4em]">PropSys</span>
      </div>
    </main>
  );
}

export function PasswordResetRequestView() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setError(null);
    setCopied(false);
    setResetLink(null);
    setIsSuccess(false);

    if (!normalizedEmail) {
      setError('Ingresa tu correo electronico.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      if (res.status === 503) {
        setError(PROVIDER_ERROR);
        return;
      }

      if (!res.ok) {
        setError('No pudimos procesar la solicitud. Intenta nuevamente.');
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { delivery?: { resetLink?: string } };
      setResetLink(typeof data.delivery?.resetLink === 'string' ? data.delivery.resetLink : null);
      setIsSuccess(true);
    } catch {
      setError('No pudimos procesar la solicitud. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopy() {
    if (!resetLink || !navigator.clipboard) return;
    await navigator.clipboard.writeText(resetLink);
    setCopied(true);
  }

  return (
    <PasswordResetShell mode="request">
      <form onSubmit={handleSubmit} className="space-y-6">
        <p className="text-sm text-slate-500 font-medium text-center">
          Ingresa tu correo y te enviaremos instrucciones si la cuenta existe.
        </p>

        <div className="space-y-2">
          <label htmlFor="reset-email" className="text-xs font-black uppercase tracking-widest text-slate-500">
            Correo electronico
          </label>
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-4 pl-12 pr-4 text-sm font-bold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </div>
        </div>

        {error ? <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

        {isSuccess ? (
          <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-700">
            <p>{REQUEST_SUCCESS}</p>
            {resetLink ? (
              <div className="space-y-2 rounded-xl border border-emerald-200 bg-white p-3 text-slate-700">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Enlace de prueba</p>
                <input
                  readOnly
                  value={resetLink}
                  className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800"
                >
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  {copied ? 'Copiado' : 'Copiar enlace'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center rounded-2xl bg-primary px-6 py-4 text-sm font-black text-white shadow-xl shadow-primary/25 transition hover:bg-primary/90 disabled:opacity-70"
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enviar enlace'}
          {!isLoading ? <ArrowRight className="ml-2 h-5 w-5" /> : null}
        </button>

        <Link
          href="/"
          className="flex items-center justify-center text-xs font-black text-slate-400 hover:text-slate-600 transition-colors py-2 uppercase tracking-widest"
        >
          <ArrowLeft className="w-3 h-3 mr-2" /> Volver al inicio
        </Link>
      </form>
    </PasswordResetShell>
  );
}

export function PasswordResetConfirmView({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const trimmedToken = token.trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      const res = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: trimmedToken, password }),
      });

      if (!res.ok) {
        setError(CONFIRM_ERROR);
        return;
      }

      setIsSuccess(true);
    } catch {
      setError(CONFIRM_ERROR);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PasswordResetShell mode="confirm">
      {!trimmedToken ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-center text-sm font-bold text-red-700">
          Enlace invalido o incompleto.
        </div>
      ) : isSuccess ? (
        <div className="text-center space-y-8">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
          </div>
          <p className="text-slate-700 font-bold">Contraseña actualizada correctamente. Ya puedes iniciar sesión.</p>
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
            <label htmlFor="new-password" className="text-xs font-black uppercase tracking-widest text-slate-500">
              Nueva contraseña
            </label>
            <div className="relative">
              <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-4 pl-12 pr-4 text-sm font-bold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-reset-password" className="text-xs font-black uppercase tracking-widest text-slate-500">
              Confirmar contraseña
            </label>
            <div className="relative">
              <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="confirm-reset-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-4 pl-12 pr-4 text-sm font-bold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </div>
          </div>

          <p className="text-xs font-medium leading-relaxed text-slate-500">
            Usa al menos 12 caracteres con mayuscula, minuscula, numero y simbolo. No uses espacios.
          </p>

          {error ? <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center rounded-2xl bg-primary px-6 py-4 text-sm font-black text-white shadow-xl shadow-primary/25 transition hover:bg-primary/90 disabled:opacity-70"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Actualizar contraseña'}
          </button>
        </form>
      )}
    </PasswordResetShell>
  );
}
