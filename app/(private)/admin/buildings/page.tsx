'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Plus, Search, Building2 } from 'lucide-react';
import { RouteGuard } from '@/lib/auth/route-guard';
import { useAuth } from '@/lib/auth/auth-context';
import { buildingsRepo } from '@/lib/data';
import { Building } from '@/lib/types';

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
        const data = await buildingsRepo.listForUser(user);
        if (!isMounted) return;
        setAllBuildings(data);
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
    const t = searchTerm.toLowerCase();
    return allBuildings.filter((b) => b.name.toLowerCase().includes(t) || b.address.toLowerCase().includes(t) || b.city.toLowerCase().includes(t));
  }, [allBuildings, searchTerm]);

  const actions = (
    <button className="flex items-center px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
      <Plus className="w-4 h-4 mr-2" /> Nuevo Edificio
    </button>
  );

  return (
    <RouteGuard allowedRoles={['MANAGER']}>
      <div className="flex flex-col h-full bg-slate-50/50">
        <PageHeader 
          title="Gestión de Edificios" 
          description="Administra el portafolio de edificios de PropSys"
          actions={actions}
        />
        
        <div className="p-6 md:p-8 space-y-6">
          <div className="relative group max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, dirección o ciudad..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            />
          </div>

          {error ? (
            <ErrorState title="Error" description={error} />
          ) : isLoading ? (
            <LoadingState title="Cargando edificios..." />
          ) : buildings.length === 0 ? (
            <EmptyState
              title="Sin edificios"
              description={searchTerm ? `No hay resultados para "${searchTerm}".` : "Aún no tienes edificios registrados en PropSys."}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
              {buildings.map((b) => (
                <div key={b.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{b.name}</p>
                    <p className="mt-1 text-xs text-slate-500 font-medium truncate">{b.address}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{b.city}</p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}
