'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { labelInternalRole, labelWorkspaceArea } from '@/lib/presentation/labels';
import { User, KeyRound, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

type FieldState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

function Field({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
      />
    </div>
  );
}

export default function AccountPage() {
  const { user } = useAuth();

  const [fields, setFields] = useState<FieldState>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [status, setStatus] = useState<FormStatus>('idle');
  const [message, setMessage] = useState('');

  const set = (key: keyof FieldState) => (v: string) =>
    setFields((prev) => ({ ...prev, [key]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (fields.newPassword !== fields.confirmPassword) {
      setStatus('error');
      setMessage('La nueva contraseña y la confirmación no coinciden.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(fields),
      });

      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!res.ok) {
        setStatus('error');
        setMessage(data?.error ?? 'No se pudo cambiar la contraseña. Intenta nuevamente.');
      } else {
        setStatus('success');
        setMessage('Contraseña actualizada correctamente.');
        setFields({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch {
      setStatus('error');
      setMessage('Error de red. Intenta nuevamente.');
    }
  };

  const workspaceArea = user ? labelWorkspaceArea(user) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Mi cuenta</h1>
        <p className="mt-1 text-sm text-slate-500">Información de tu perfil y configuración de acceso.</p>
      </div>

      {/* Profile info */}
      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">{user?.name}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Rol</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">
              {user ? labelInternalRole(user.internalRole) : '—'}
            </dd>
          </div>

          {workspaceArea && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Área</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{workspaceArea}</dd>
            </div>
          )}

          {user?.clientId && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cliente</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800 font-mono text-xs">{user.clientId}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Change password */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <KeyRound className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-slate-900">Cambiar contraseña</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Field
            id="account-current-password"
            label="Contraseña actual"
            value={fields.currentPassword}
            onChange={set('currentPassword')}
            disabled={status === 'loading'}
          />
          <Field
            id="account-new-password"
            label="Nueva contraseña"
            value={fields.newPassword}
            onChange={set('newPassword')}
            disabled={status === 'loading'}
          />
          <p className="text-xs text-slate-400 -mt-2">Mínimo 8 caracteres, al menos una letra y un número.</p>
          <Field
            id="account-confirm-password"
            label="Confirmar nueva contraseña"
            value={fields.confirmPassword}
            onChange={set('confirmPassword')}
            disabled={status === 'loading'}
          />

          {status === 'success' && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              {message}
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {message}
            </div>
          )}

          <button
            type="submit"
            id="account-change-password-btn"
            disabled={status === 'loading'}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === 'loading' ? 'Cambiando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </section>
    </div>
  );
}
