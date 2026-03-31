'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { CalendarDays, Plus, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { buildingsRepo, commonAreasRepo, reservationsRepo, unitsRepo } from '@/lib/data';
import { Building, CommonArea, Reservation, Unit } from '@/lib/types';

function statusChip(status: Reservation['status']) {
  const base = 'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest';
  if (status === 'REQUESTED') return `${base} bg-amber-50 text-amber-700`;
  if (status === 'APPROVED') return `${base} bg-emerald-50 text-emerald-700`;
  if (status === 'REJECTED') return `${base} bg-rose-50 text-rose-700`;
  return `${base} bg-slate-100 text-slate-600`;
}

export default function ResidentReservationsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [areas, setAreas] = useState<CommonArea[]>([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setError(null);
        const [r, u, b] = await Promise.all([
          reservationsRepo.listForUser(user),
          unitsRepo.listForUser(user),
          buildingsRepo.listForUser(user),
        ]);
        const buildingIds = Array.from(new Set(b.map((x) => x.id)));
        const areasByBuilding = await Promise.all(buildingIds.map((id) => commonAreasRepo.listForBuilding(id)));
        if (!isMounted) return;
        setReservations(r);
        setUnits(u);
        setBuildings(b);
        setAreas(areasByBuilding.flat());
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar tus reservas.');
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

  const areaNameById = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas]);
  const unitLabelById = useMemo(() => new Map(units.map((u) => [u.id, `Depto ${u.number}`])), [units]);
  const buildingNameById = useMemo(() => new Map(buildings.map((b) => [b.id, b.name])), [buildings]);

  const filtered = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return reservations
      .filter((r) => {
        const areaName = areaNameById.get(r.commonAreaId) ?? '';
        const unitLabel = unitLabelById.get(r.unitId) ?? '';
        return areaName.toLowerCase().includes(t) || unitLabel.toLowerCase().includes(t) || r.status.toLowerCase().includes(t);
      })
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }, [reservations, searchTerm, areaNameById, unitLabelById]);

  const actions = (
    <button className="flex items-center px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95">
      <Plus className="w-5 h-5 mr-3" /> Nueva Reserva
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Reservas" description="Reserva áreas comunes según disponibilidad y reglas del edificio" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        <div className="relative group max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por área, depto o estado..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
          />
        </div>

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando reservas..." />
        ) : filtered.length === 0 ? (
          <EmptyState title="Sin reservas" description={searchTerm ? `No hay resultados para "${searchTerm}".` : 'Aún no tienes reservas registradas.'} />
        ) : (
          <div className="space-y-3 max-w-4xl">
            {filtered.map((r) => (
              <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={statusChip(r.status)}>{r.status}</span>
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                      {unitLabelById.get(r.unitId) ?? r.unitId}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-black text-slate-900">
                    {areaNameById.get(r.commonAreaId) ?? 'Área común'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 font-medium">
                    {buildingNameById.get(r.buildingId) ?? 'Edificio'} · {new Date(r.startAt).toLocaleString('es-CL')} – {new Date(r.endAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="w-6 h-6 text-primary" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

