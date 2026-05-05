'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Send, Search, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import {
  createAdminUser,
  loadAdminUsersPageData,
  updateAdminUserProfile,
  updateAdminUserStatus,
} from '@/lib/features/users/users-center.data';
import { InvitationCreationDialog } from '@/lib/features/users/invitations.ui';
import { UserCard, buildBuildingNameMap, buildUnitLabelMap } from '@/lib/features/users/users-center.ui';
import { labelUserRole } from '@/lib/presentation/labels';
import type { Building, Unit, User } from '@/lib/types';

type FormMode = 'create' | 'edit';
type RoleOption = 'BUILDING_ADMIN' | 'STAFF' | 'OWNER' | 'OCCUPANT';

type UserFormState = {
  name: string;
  email: string;
  internalRole: RoleOption;
  buildingId: string;
  unitId: string;
  password: string;
};

const INITIAL_FORM: UserFormState = {
  name: '',
  email: '',
  internalRole: 'STAFF',
  buildingId: '',
  unitId: '',
  password: '',
};

export default function UsersPage() {
  const { user } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formState, setFormState] = useState<UserFormState>(INITIAL_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [tempPasswordNotice, setTempPasswordNotice] = useState<string | null>(null);
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

  function handleOpenCreateForm() {
    setActionError(null);
    setTempPasswordNotice(null);
    setFormMode('create');
    setEditingUserId(null);
    setFormState(INITIAL_FORM);
  }

  function handleOpenEditForm(target: User) {
    setActionError(null);
    setTempPasswordNotice(null);
    setFormMode('edit');
    setEditingUserId(target.id);
    setFormState({
      name: target.name,
      email: target.email,
      internalRole: target.internalRole === 'OCCUPANT' ? 'OCCUPANT' : (target.internalRole as RoleOption),
      buildingId: target.buildingId ?? '',
      unitId: target.unitId ?? '',
      password: '',
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

    if ((formState.internalRole === 'BUILDING_ADMIN' || formState.internalRole === 'STAFF') && !formState.buildingId && formMode === 'create') {
      setActionError('Selecciona un edificio.');
      return;
    }
    if ((formState.internalRole === 'OWNER' || formState.internalRole === 'OCCUPANT') && !formState.unitId && formMode === 'create') {
      setActionError('Selecciona una unidad.');
      return;
    }

    try {
      setFormSubmitting(true);
      setActionError(null);
      setTempPasswordNotice(null);

      if (formMode === 'create') {
        const created = await createAdminUser(user, {
          name,
          email,
          internalRole: formState.internalRole,
          buildingId: formState.buildingId || undefined,
          unitId: formState.unitId || undefined,
          password: formState.password.trim() || undefined,
        });
        setAllUsers((current) => [created.user, ...current]);
        if (created.tempPassword) {
          setTempPasswordNotice(`Contrasena temporal para ${created.user.email}: ${created.tempPassword}`);
        }
      } else if (editingUserId) {
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
  const visibleUnits = useMemo(() => {
    if (!formState.buildingId) return units;
    return units.filter((item) => item.buildingId === formState.buildingId);
  }, [formState.buildingId, units]);

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
  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {canInviteUsers ? (
        <button
          type="button"
          onClick={() => setIsInvitationOpen(true)}
          className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition"
        >
          <Send className="w-4 h-4 mr-2" /> Invitar usuario
        </button>
      ) : null}
      <button
        type="button"
        onClick={handleOpenCreateForm}
        className="flex items-center px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition"
      >
        <UserPlus className="w-4 h-4 mr-2" /> Nuevo Usuario
      </button>
    </div>
  );

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
        {tempPasswordNotice ? (
          <div className="max-w-2xl rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {tempPasswordNotice}
          </div>
        ) : null}

        {formMode ? (
          <form onSubmit={handleSubmitForm} className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">{formMode === 'create' ? 'Crear usuario' : 'Editar usuario'}</h2>
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

            {formMode === 'create' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-bold text-slate-600">Rol</span>
                  <select
                    value={formState.internalRole}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        internalRole: event.target.value as RoleOption,
                        unitId: '',
                        buildingId: '',
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="BUILDING_ADMIN">Administrador de edificio</option>
                    <option value="STAFF">Staff</option>
                    <option value="OWNER">Propietario</option>
                    <option value="OCCUPANT">Inquilino</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-bold text-slate-600">Contrasena (opcional)</span>
                  <input
                    type="text"
                    value={formState.password}
                    onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))}
                    placeholder="Se genera automatica si esta vacio"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>

                {formState.internalRole === 'BUILDING_ADMIN' || formState.internalRole === 'STAFF' ? (
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-bold text-slate-600">Edificio</span>
                    <select
                      value={formState.buildingId}
                      onChange={(event) => setFormState((current) => ({ ...current, buildingId: event.target.value, unitId: '' }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                      required
                    >
                      <option value="">Selecciona edificio</option>
                      {buildings.map((building) => (
                        <option key={building.id} value={building.id}>
                          {building.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-bold text-slate-600">Unidad</span>
                    <select
                      value={formState.unitId}
                      onChange={(event) => setFormState((current) => ({ ...current, unitId: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                      required
                    >
                      <option value="">Selecciona unidad</option>
                      {visibleUnits.map((unitOption) => (
                        <option key={unitOption.id} value={unitOption.id}>
                          {`${buildingNameById.get(unitOption.buildingId) ?? 'Edificio'} - Depto ${unitOption.number}`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            ) : null}

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
                {formSubmitting ? 'Guardando...' : formMode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
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
          description="Crea una invitacion para que el usuario defina su contrasena."
          roleOptions={['BUILDING_ADMIN', 'STAFF', 'OWNER', 'OCCUPANT']}
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
