'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import { loadAdminBuildingsPageData } from '@/lib/features/physical/physical-center.data';
import { BuildingCard } from '@/lib/features/physical/physical-center.ui';
import type { Building } from '@/lib/types';

export default function BuildingsPage() {
  const { user } = useAuth();
  const [allBuildings, setAllBuildings] = useState<Building[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await loadAdminBuildingsPageData(user);
        if (!isMounted) return;
        setAllBuildings(data.buildings);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar los edificios.');
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

  const buildings = useMemo(() => {
    const normalizedTerm = searchTerm.toLowerCase();
    return allBuildings.filter(
      (building) =>
        building.name.toLowerCase().includes(normalizedTerm) ||
        building.address.toLowerCase().includes(normalizedTerm) ||
        building.city.toLowerCase().includes(normalizedTerm)
    );
  }, [allBuildings, searchTerm]);

  const actions = (
    <button disabled className="flex items-center px-4 py-2 bg-slate-100 text-slate-400 rounded-xl font-bold text-sm cursor-not-allowed">
      <Plus className="w-4 h-4 mr-2" /> Proximamente
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Gestion de Edificios" description="Administra el portafolio de edificios de PropSys" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        <div className="relative group max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por nombre, direccion o ciudad..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
          />
        </div>

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando edificios..." />
        ) : buildings.length === 0 ? (
          <EmptyState title="Sin edificios" description={searchTerm ? `No hay resultados para "${searchTerm}".` : 'Aun no tienes edificios registrados en PropSys.'} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
            {buildings.map((building) => (
              <BuildingCard key={building.id} building={building} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
