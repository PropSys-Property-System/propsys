'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import { listStaffForBuilding, loadAdminStaffPageData } from '@/lib/features/physical/physical-center.data';
import { BuildingScopeToolbar, StaffCard, buildingToolbarIcon } from '@/lib/features/physical/physical-center.ui';
import type { Building, StaffMember } from '@/lib/types';

export default function AdminStaffPage() {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadBuildings = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await loadAdminStaffPageData(user);
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

    const loadStaff = async () => {
      if (!user || !selectedBuildingId) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await listStaffForBuilding(user, selectedBuildingId);
        if (!isMounted) return;
        setStaff(data);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar el staff.');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    loadStaff();

    return () => {
      isMounted = false;
    };
  }, [selectedBuildingId, user]);

  const filteredStaff = useMemo(() => {
    const normalizedTerm = searchTerm.toLowerCase();
    return staff.filter(
      (staffMember) =>
        staffMember.name.toLowerCase().includes(normalizedTerm) ||
        staffMember.role.toLowerCase().includes(normalizedTerm)
    );
  }, [searchTerm, staff]);

  const actions = (
    <button disabled className="flex items-center px-4 py-2 bg-slate-100 text-slate-400 rounded-xl font-bold text-sm cursor-not-allowed">
      <Plus className="w-4 h-4 mr-2" /> Proximamente
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Staff del Edificio" description="Planilla operativa (seguridad, limpieza, conserjeria, etc.)" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        {buildings.length > 1 && (
          <BuildingScopeToolbar
            title="Edificio"
            icon={buildingToolbarIcon()}
            buildings={buildings}
            selectedBuildingId={selectedBuildingId}
            searchTerm={searchTerm}
            searchPlaceholder="Buscar por nombre o rol..."
            onBuildingChange={setSelectedBuildingId}
            onSearchChange={setSearchTerm}
          />
        )}

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando staff..." />
        ) : !selectedBuildingId ? (
          <EmptyState title="Sin edificio" description="No hay un edificio seleccionado para mostrar su staff." />
        ) : filteredStaff.length === 0 ? (
          <EmptyState title="Sin resultados" description={searchTerm ? `No hay coincidencias para "${searchTerm}".` : 'Aun no hay staff registrado para este edificio.'} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredStaff.map((staffMember) => (
              <StaffCard key={staffMember.id} staffMember={staffMember} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
