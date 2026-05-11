'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import { loadResidentUnitsPageData } from '@/lib/features/physical/physical-center.data';
import { ResidentUnitCard } from '@/lib/features/physical/physical-center.ui';
import type { Building, Unit } from '@/lib/types';

export default function ResidentUnitsPage() {
  const { user } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await loadResidentUnitsPageData(user);
        if (!isMounted) return;
        setUnits(data.units);
        setBuildings(data.buildings);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar tus unidades.');
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

  const buildingNameById = useMemo(() => new Map(buildings.map((building) => [building.id, building.name])), [buildings]);

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Mis Unidades" description="Administra tus departamentos y su informacion asociada" />

      <div className="p-6 md:p-8">
        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando unidades..." />
        ) : units.length === 0 ? (
          <EmptyState title="Sin unidades" description="No hay unidades asociadas a tu cuenta." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            {units.map((unit) => (
              <ResidentUnitCard key={unit.id} unit={unit} buildingName={buildingNameById.get(unit.buildingId)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
