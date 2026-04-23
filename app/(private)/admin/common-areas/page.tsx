'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import {
  listCommonAreasForBuilding,
  loadAdminCommonAreasPageData,
  updateCommonAreaApprovalForUser,
} from '@/lib/features/physical/physical-center.data';
import { BuildingScopeToolbar, CommonAreaCard, buildingToolbarIcon } from '@/lib/features/physical/physical-center.ui';
import type { Building, CommonArea } from '@/lib/types';

export default function AdminCommonAreasPage() {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [areas, setAreas] = useState<CommonArea[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingAreaId, setSavingAreaId] = useState<string | null>(null);
  const canManageApproval = user?.internalRole === 'CLIENT_MANAGER' || user?.internalRole === 'ROOT_ADMIN';

  useEffect(() => {
    let isMounted = true;

    const loadBuildings = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await loadAdminCommonAreasPageData(user);
        if (!isMounted) return;
        setBuildings(data.buildings);
        setSelectedBuildingId((prev) => prev || data.defaultBuildingId);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar los edificios.');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    loadBuildings();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const loadAreas = async () => {
      if (!user || !selectedBuildingId) return;

      try {
        setIsLoading(true);
        setError(null);
        setActionError(null);
        const data = await listCommonAreasForBuilding(user, selectedBuildingId);
        if (!isMounted) return;
        setAreas(data);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar las areas comunes.');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    loadAreas();

    return () => {
      isMounted = false;
    };
  }, [selectedBuildingId, user]);

  const filteredAreas = useMemo(() => {
    const normalizedTerm = searchTerm.toLowerCase();
    return areas.filter((area) => area.name.toLowerCase().includes(normalizedTerm));
  }, [areas, searchTerm]);

  const updateApproval = async (area: CommonArea, nextRequiresApproval: boolean) => {
    if (!user) return;

    try {
      setSavingAreaId(area.id);
      setActionError(null);
      const updated = await updateCommonAreaApprovalForUser(user, area.id, nextRequiresApproval);
      setAreas((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos actualizar el area comun.');
    } finally {
      setSavingAreaId(null);
    }
  };

  const actions = canManageApproval ? (
    <button disabled className="flex items-center px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-bold text-sm cursor-default">
      <Plus className="w-4 h-4 mr-2" /> Gestion activa
    </button>
  ) : null;

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Areas Comunes" description="Configura espacios reservables y reglas de aprobacion" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        {actionError && <ErrorState title="Accion no disponible" description={actionError} />}

        {buildings.length > 1 && (
          <BuildingScopeToolbar
            title="Edificio"
            icon={buildingToolbarIcon()}
            buildings={buildings}
            selectedBuildingId={selectedBuildingId}
            searchTerm={searchTerm}
            searchPlaceholder="Buscar area comun..."
            onBuildingChange={setSelectedBuildingId}
            onSearchChange={setSearchTerm}
          />
        )}

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando areas comunes..." />
        ) : !selectedBuildingId ? (
          <EmptyState title="Sin edificio" description="No hay un edificio seleccionado." />
        ) : filteredAreas.length === 0 ? (
          <EmptyState title="Sin areas" description={searchTerm ? `No hay coincidencias para "${searchTerm}".` : 'Aun no hay areas comunes configuradas.'} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
            {filteredAreas.map((area) => (
              <CommonAreaCard
                key={area.id}
                area={area}
                canManageApproval={Boolean(canManageApproval)}
                savingAreaId={savingAreaId}
                onToggleApproval={updateApproval}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
