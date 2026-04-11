'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Users, Phone, Plus, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { buildingsRepo, staffRepo } from '@/lib/data';
import { Building, StaffMember } from '@/lib/types';

export default function AdminStaffPage() {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
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
    const loadStaff = async () => {
      if (!user) return;
      if (!selectedBuildingId) return;
      try {
        setIsLoading(true);
        setError(null);
        const data = await staffRepo.listForBuilding(user, selectedBuildingId);
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

  const filtered = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return staff.filter((s) => s.name.toLowerCase().includes(t) || s.role.toLowerCase().includes(t));
  }, [staff, searchTerm]);

  const actions = (
    <button
      disabled
      className="flex items-center px-4 py-2 bg-slate-100 text-slate-400 rounded-xl font-bold text-sm cursor-not-allowed"
    >
      <Plus className="w-4 h-4 mr-2" /> Próximamente
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader
        title="Staff del Edificio"
        description="Planilla operativa (seguridad, limpieza, conserjería, etc.)"
        actions={actions}
      />

      <div className="p-6 md:p-8 space-y-6">
        {buildings.length > 1 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-4 md:items-center">
            <div className="flex items-center text-sm font-bold text-slate-700">
              <Users className="w-4 h-4 mr-2 text-primary" /> Edificio
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
                placeholder="Buscar por nombre o rol..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              />
            </div>
          </div>
        )}

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando staff..." />
        ) : !selectedBuildingId ? (
          <EmptyState title="Sin edificio" description="No hay un edificio seleccionado para mostrar su staff." />
        ) : filtered.length === 0 ? (
          <EmptyState title="Sin resultados" description={searchTerm ? `No hay coincidencias para "${searchTerm}".` : 'Aún no hay staff registrado para este edificio.'} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate">{s.name}</p>
                  <p className="text-xs text-slate-500 font-bold mt-1">{s.role}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {s.shift && (
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                        Turno {s.shift}
                      </span>
                    )}
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {s.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
                {s.phone && (
                  <a
                    href={`tel:${s.phone}`}
                    className="flex items-center px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-600 hover:border-slate-200 transition-all"
                  >
                    <Phone className="w-4 h-4 mr-2 text-primary" /> Llamar
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


