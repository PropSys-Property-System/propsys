'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Home, Plus, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { buildingsRepo, commonAreasRepo } from '@/lib/data';
import { Building, CommonArea } from '@/lib/types';

export default function AdminCommonAreasPage() {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [areas, setAreas] = useState<CommonArea[]>([]);
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
        const data = await buildingsRepo.listForUser(user);
        if (!isMounted) return;
        setBuildings(data);
        setSelectedBuildingId((prev) => prev || data[0]?.id || '');
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
      if (!user) return;
      if (!selectedBuildingId) return;
      try {
        setIsLoading(true);
        setError(null);
        const data = await commonAreasRepo.listForBuilding(user, selectedBuildingId);
        if (!isMounted) return;
        setAreas(data);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar las áreas comunes.');
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

  const filtered = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return areas.filter((a) => a.name.toLowerCase().includes(t));
  }, [areas, searchTerm]);

  const actions = (
    <button className="flex items-center px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
      <Plus className="w-4 h-4 mr-2" /> Nueva Área
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader
        title="Áreas Comunes"
        description="Configura espacios reservables y reglas de aprobación"
        actions={actions}
      />

      <div className="p-6 md:p-8 space-y-6">
        {buildings.length > 1 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-4 md:items-center">
            <div className="flex items-center text-sm font-bold text-slate-700">
              <Home className="w-4 h-4 mr-2 text-primary" /> Edificio
            </div>
            <select
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              className="w-full md:w-80 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all"
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar área común..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              />
            </div>
          </div>
        )}

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando áreas comunes..." />
        ) : !selectedBuildingId ? (
          <EmptyState title="Sin edificio" description="No hay un edificio seleccionado." />
        ) : filtered.length === 0 ? (
          <EmptyState title="Sin áreas" description={searchTerm ? `No hay coincidencias para "${searchTerm}".` : 'Aún no hay áreas comunes configuradas.'} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
            {filtered.map((a) => (
              <div key={a.id} className="bg-white border border-slate-200 rounded-2xl p-6">
                <p className="text-sm font-black text-slate-900">{a.name}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  {typeof a.capacity === 'number' ? `Capacidad ${a.capacity}` : 'Capacidad no definida'}
                </p>
                <div className="mt-4">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${a.requiresApproval ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {a.requiresApproval ? 'Requiere aprobación' : 'Auto-aprobación'}
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

