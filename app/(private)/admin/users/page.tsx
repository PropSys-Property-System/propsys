'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Send, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import {
  loadAdminUsersPageData,
  updateAdminUserProfile,
  updateAdminUserStatus,
} from '@/lib/features/users/users-center.data';
import Link from 'next/link';
import { InvitationCreationDialog } from '@/lib/features/users/invitations.ui';
import { UserCard, buildBuildingNameMap, buildUnitLabelMap } from '@/lib/features/users/users-center.ui';
import { labelUserRole } from '@/lib/presentation/labels';
import type { Building, Unit, User } from '@/lib/types';
import type { ClientAccount } from '@/lib/repos/core/clients.repo';

type FormMode = 'edit';

type UserFormState = {
  name: string;
  email: string;
};

const INITIAL_FORM: UserFormState = {
  name: '',
  email: '',
};

export default function UsersPage() {
  const { user } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formState, setFormState] = useState<UserFormState>(INITIAL_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [isInvitationOpen, setIsInvitationOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        setActionError(null);
        const data = await loadAdminUsersPageData(user);
        if (!isMounted) return;
        setAllUsers(data.users);
        setBuildings(data.buildings);
        setUnits(data.units);
        setClients(data.clients ?? []);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar los usuarios.');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [user]);

  async function handleStatusChange(target: User) {
    if (!user) return;

    const nextStatus = target.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const actionLabel = nextStatus === 'SUSPENDED' ? 'suspender' : 'reactivar';
    const confirmed = window.confirm(`¿Quieres ${actionLabel} a ${target.name}?`);
    if (!confirmed) return;

    try {
      setPendingUserId(target.id);
      setActionError(null);
      const updated = await updateAdminUserStatus(user, { userId: target.id, status: nextStatus });
      setAllUsers((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, status: updated.status } : item))
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos actualizar el estado del usuario.');
    } finally {
      setPendingUserId(null);
    }
  }

  function closeForm() {
    setFormMode(null);
    setEditingUserId(null);
    setFormState(INITIAL_FORM);
    setFormSubmitting(false);
  }

  function handleOpenEditForm(target: User) {
    setActionError(null);
    setFormMode('edit');
    setEditingUserId(target.id);
    setFormState({
      name: target.name,
      email: target.email,
    });
  }

  async function handleSubmitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !formMode) return;

    const name = formState.name.trim();
    const email = formState.email.trim().toLowerCase();
    if (!name || !email) {
      setActionError('Completa nombre y email.');
      return;
    }

    try {
      setFormSubmitting(true);
      setActionError(null);

      if (editingUserId) {
        const updated = await updateAdminUserProfile(user, {
          userId: editingUserId,
          name,
          email,
        });
        setAllUsers((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      }

      closeForm();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos guardar el usuario.');
    } finally {
      setFormSubmitting(false);
    }
  }

  const buildingNameById = useMemo(() => buildBuildingNameMap(buildings), [buildings]);
  const unitLabelById = useMemo(() => buildUnitLabelMap(units), [units]);

  const users = useMemo(() => {
    const normalizedTerm = searchTerm.toLowerCase();
    return allUsers.filter((candidate) => {
      const roleLabel = labelUserRole(candidate.role).toLowerCase();
      const buildingName = candidate.buildingId ? buildingNameById.get(candidate.buildingId)?.toLowerCase() ?? '' : '';
      const unitLabel = candidate.unitId ? unitLabelById.get(candidate.unitId)?.toLowerCase() ?? '' : '';

      return (
        candidate.name.toLowerCase().includes(normalizedTerm) ||
        candidate.email.toLowerCase().includes(normalizedTerm) ||
        roleLabel.includes(normalizedTerm) ||
        buildingName.includes(normalizedTerm) ||
        unitLabel.includes(normalizedTerm)
      );
    });
  }, [allUsers, buildingNameById, searchTerm, unitLabelById]);

  const canInviteUsers = user?.internalRole === 'ROOT_ADMIN' || user?.internalRole === 'CLIENT_MANAGER';
  const canCreateClient = user?.internalRole === 'ROOT_ADMIN';
  const invitationRoleOptions =
    user?.internalRole === 'ROOT_ADMIN'
      ? (['CLIENT_MANAGER', 'BUILDING_ADMIN', 'STAFF', 'OWNER', 'OCCUPANT'] as const)
      : (['BUILDING_ADMIN', 'STAFF', 'OWNER', 'OCCUPANT'] as const);
  const actions = canInviteUsers ? (
    <div className="flex flex-wrap items-center gap-2">
      {canCreateClient ? (
        <Link
          href="/admin/clients"
          className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition"
        >
          Gestionar clientes
        </Link>
      ) : null}
      <button
        type="button"
        onClick={() => setIsInvitationOpen(true)}
        className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition"
      >
        <Send className="w-4 h-4 mr-2" /> Invitar usuario
      </button>
    </div>
  ) : null;



  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Gestion de Usuarios" description="Administra los roles y accesos de PropSys" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        <div className="relative group max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por nombre, email o rol..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
          />
        </div>

        {actionError ? (
          <div className="max-w-2xl rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {actionError}
          </div>
        ) : null}



        {formMode ? (
          <form onSubmit={handleSubmitForm} className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">Editar usuario</h2>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs font-bold text-slate-600">Nombre</span>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                  required
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold text-slate-600">Email</span>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                  required
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={formSubmitting}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {formSubmitting ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        ) : null}

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando usuarios..." />
        ) : users.length === 0 ? (
          <EmptyState title="Sin usuarios" description={searchTerm ? `No hay resultados para "${searchTerm}".` : 'No hay usuarios disponibles.'} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
            {user &&
              users.map((candidate) => (
                <UserCard
                  key={candidate.id}
                  currentUser={user}
                  targetUser={candidate}
                  buildings={buildingNameById}
                  units={unitLabelById}
                  pendingUserId={pendingUserId}
                  onStatusChange={handleStatusChange}
                  onEdit={handleOpenEditForm}
                />
              ))}
          </div>
        )}
      </div>

      {canInviteUsers ? (
        <InvitationCreationDialog
          isOpen={isInvitationOpen}
          title="Invitar usuario"
          description="Crea una invitación para que el usuario defina su contraseña."
          roleOptions={[...invitationRoleOptions]}
          clients={clients}
          buildings={buildings}
          units={units}
          onClose={() => setIsInvitationOpen(false)}
          onInvitationCreated={(result) => {
            const invitedUser = result.user;
            if (!invitedUser) return;
            setAllUsers((current) => [invitedUser, ...current.filter((item) => item.id !== invitedUser.id)]);
          }}
        />
      ) : null}
    </div>
  );
}
