'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Building2, Home } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { loadResidentUnitsPageData } from '@/lib/features/physical/physical-center.data';
import { Building, Unit } from '@/lib/types';

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

  const buildingNameById = new Map(buildings.map((b) => [b.id, b.name]));

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Mis Unidades" description="Administra tus departamentos y su información asociada" />

      <div className="p-6 md:p-8">
        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando unidades..." />
        ) : units.length === 0 ? (
          <EmptyState title="Sin unidades" description="No hay unidades asociadas a tu cuenta." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            {units.map((u) => (
              <div key={u.id} className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">Depto {u.number}</p>
                    <p className="mt-1 text-xs text-slate-500 font-medium">
                      {buildingNameById.get(u.buildingId) ?? 'Edificio'} · Piso {u.floor ?? '-'}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Home className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                    {u.residentId ? 'Con inquilino' : 'Sin inquilino'}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center">
                    <Building2 className="w-3.5 h-3.5 mr-1.5" /> Unidad {u.id}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


