'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import { loadAdminUsersPageData, updateAdminUserStatus } from '@/lib/features/users/users-center.data';
import { UserCard, buildBuildingNameMap, buildUnitLabelMap } from '@/lib/features/users/users-center.ui';
import { labelUserRole } from '@/lib/presentation/labels';
import type { Building, Unit, User } from '@/lib/types';

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

  const actions = (
    <button disabled className="flex items-center px-4 py-2 bg-slate-100 text-slate-400 rounded-xl font-bold text-sm cursor-not-allowed">
      <UserPlus className="w-4 h-4 mr-2" /> Proximamente
    </button>
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
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
