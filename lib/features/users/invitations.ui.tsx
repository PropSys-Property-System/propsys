'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Copy, Send, X } from 'lucide-react';
import type { Building, Unit } from '@/lib/types';
import type { ClientAccount } from '@/lib/repos/core/clients.repo';
import {
  createUserInvitation,
  type CreateUserInvitationInput,
  type CreateUserInvitationResult,
  type UserInvitationRole,
} from './invitations.data';

const ROLE_LABELS: Record<UserInvitationRole, string> = {
  CLIENT_MANAGER: 'Manager de cliente',
  BUILDING_ADMIN: 'Administrador de edificio',
  STAFF: 'Staff',
  OWNER: 'Propietario',
  OCCUPANT: 'Inquilino',
};

type InvitationCreationDialogProps = {
  isOpen: boolean;
  title: string;
  description: string;
  roleOptions: UserInvitationRole[];
  clients?: ClientAccount[];
  buildings: Building[];
  units: Unit[];
  defaultRole?: UserInvitationRole;
  defaultClientId?: string;
  defaultBuildingId?: string;
  defaultUnitId?: string;
  createInvitation?: (input: CreateUserInvitationInput) => Promise<CreateUserInvitationResult>;
  onClose: () => void;
  onInvitationCreated?: (result: CreateUserInvitationResult) => void;
};

function isBuildingRole(role: UserInvitationRole): boolean {
  return role === 'BUILDING_ADMIN' || role === 'STAFF';
}

function isUnitRole(role: UserInvitationRole): boolean {
  return role === 'OWNER' || role === 'OCCUPANT';
}

function resolveDefaultRole(roleOptions: UserInvitationRole[], defaultRole?: UserInvitationRole): UserInvitationRole {
  if (defaultRole && roleOptions.includes(defaultRole)) return defaultRole;
  return roleOptions[0] ?? 'STAFF';
}

function resolveDefaultRoleFromKey(roleOptionsKey: string, defaultRole?: UserInvitationRole): UserInvitationRole {
  return resolveDefaultRole(roleOptionsKey.split('|').filter(Boolean) as UserInvitationRole[], defaultRole);
}

function unitLabel(unit: Unit, buildingsById: Map<string, Building>): string {
  const buildingName = buildingsById.get(unit.buildingId)?.name;
  return buildingName ? `Depto ${unit.number} - ${buildingName}` : `Depto ${unit.number}`;
}

export function InvitationCreationDialog({
  isOpen,
  title,
  description,
  roleOptions,
  clients = [],
  buildings,
  units,
  defaultRole,
  defaultClientId = '',
  defaultBuildingId = '',
  defaultUnitId = '',
  createInvitation: createInvitationFn = createUserInvitation,
  onClose,
  onInvitationCreated,
}: InvitationCreationDialogProps) {
  const roleOptionsKey = roleOptions.join('|');
  const initialRole = resolveDefaultRoleFromKey(roleOptionsKey, defaultRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [internalRole, setInternalRole] = useState<UserInvitationRole>(initialRole);
  const [clientId, setClientId] = useState(defaultClientId);
  const [buildingId, setBuildingId] = useState(defaultBuildingId);
  const [unitId, setUnitId] = useState(defaultUnitId);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdInvitation, setCreatedInvitation] = useState<CreateUserInvitationResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const nextRole = resolveDefaultRoleFromKey(roleOptionsKey, defaultRole);
    setName('');
    setEmail('');
    setInternalRole(nextRole);
    setClientId(defaultClientId);
    setBuildingId(defaultBuildingId);
    setUnitId(defaultUnitId);
    setError(null);
    setIsSubmitting(false);
    setCreatedInvitation(null);
  }, [defaultBuildingId, defaultClientId, defaultRole, defaultUnitId, isOpen, roleOptionsKey]);

  const buildingsById = useMemo(() => new Map(buildings.map((building) => [building.id, building])), [buildings]);
  const visibleUnits = useMemo(() => {
    if (!buildingId) return units;
    return units.filter((unit) => unit.buildingId === buildingId);
  }, [buildingId, units]);
  const inviteLink = createdInvitation?.delivery?.inviteLink;

  if (!isOpen) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName || !normalizedEmail) {
      setError('Completa nombre y email.');
      return;
    }
    if (!normalizedEmail.includes('@')) {
      setError('Ingresa un email valido.');
      return;
    }
    if (internalRole === 'CLIENT_MANAGER' && !clientId) {
      setError('Selecciona un cliente para ese rol.');
      return;
    }
    if (isBuildingRole(internalRole) && !buildingId) {
      setError('Selecciona un edificio para ese rol.');
      return;
    }
    if (isUnitRole(internalRole) && !unitId) {
      setError('Selecciona una unidad para ese rol.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const result = await createInvitationFn({
        email: normalizedEmail,
        name: normalizedName,
        internalRole,
        ...(internalRole === 'CLIENT_MANAGER' ? { clientId } : {}),
        ...(isBuildingRole(internalRole) ? { buildingId } : {}),
        ...(isUnitRole(internalRole) ? { unitId } : {}),
      });
      setCreatedInvitation(result);
      onInvitationCreated?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos crear la invitacion.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Cerrar"
        type="button"
        className="absolute inset-0 bg-black/30"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
      />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-black text-slate-900">{createdInvitation ? 'Invitacion creada' : title}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {createdInvitation ? 'Invitacion creada. Copia este enlace y enviaselo al usuario.' : description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {createdInvitation ? (
          <div className="mt-5 space-y-4">
            {inviteLink ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Link de invitacion</p>
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                  <span className="font-bold">⚠️ Copia este enlace ahora.</span> Mientras no haya proveedor de correo, debes enviarlo manualmente al usuario. Si cierras esta ventana, la reemisión quedará para un módulo futuro de gestión de invitaciones.
                </div>
                <p className="mt-2 break-all text-sm font-bold text-emerald-900">{inviteLink}</p>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(inviteLink)}
                  className="mt-4 inline-flex items-center rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-50"
                >
                  <Copy className="mr-2 h-4 w-4" /> Copiar enlace
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                Invitacion creada y enviada por correo. Pide al usuario que revise su bandeja de entrada.
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 hover:bg-primary/90"
              >
                Listo
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-bold text-slate-600">Nombre</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                  autoFocus
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold text-slate-600">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-xs font-bold text-slate-600">Rol</span>
              <select
                value={internalRole}
                onChange={(event) => {
                  setInternalRole(event.target.value as UserInvitationRole);
                  setClientId(defaultClientId);
                  setBuildingId(defaultBuildingId);
                  setUnitId(defaultUnitId);
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>

            {internalRole === 'CLIENT_MANAGER' ? (
              <label className="space-y-1">
                <span className="text-xs font-bold text-slate-600">Cliente</span>
                <select
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Selecciona cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : isBuildingRole(internalRole) ? (
              <label className="space-y-1">
                <span className="text-xs font-bold text-slate-600">Edificio</span>
                <select
                  value={buildingId}
                  onChange={(event) => setBuildingId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Selecciona edificio</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : isUnitRole(internalRole) ? (
              <label className="space-y-1">
                <span className="text-xs font-bold text-slate-600">Unidad</span>
                <select
                  value={unitId}
                  onChange={(event) => setUnitId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Selecciona unidad</option>
                  {visibleUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unitLabel(unit, buildingsById)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {error ? <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-70"
              >
                <Send className="mr-2 h-4 w-4" /> {isSubmitting ? 'Enviando...' : 'Enviar invitacion'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
