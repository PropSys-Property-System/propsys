'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { CalendarDays, Plus, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { buildingsRepo, commonAreasRepo, reservationsRepo, unitsRepo } from '@/lib/data';
import { formatDateTime, formatTime } from '@/lib/presentation/dates';
import { Building, CommonArea, Reservation, Unit } from '@/lib/types';
import { labelReservationStatus } from '@/lib/presentation/labels';

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [areas, setAreas] = useState<CommonArea[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createUnitId, setCreateUnitId] = useState('');
  const [createAreaId, setCreateAreaId] = useState('');
  const [createStartAt, setCreateStartAt] = useState('');
  const [createEndAt, setCreateEndAt] = useState('');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setError(null);
        setActionError(null);
        const [r, u, b] = await Promise.all([
          reservationsRepo.listForUser(user),
          unitsRepo.listForUser(user),
          buildingsRepo.listForUser(user),
        ]);
        const buildingIds = Array.from(new Set(b.map((x) => x.id)));
        const areasByBuilding = await Promise.all(buildingIds.map((id) => commonAreasRepo.listForBuilding(user, id)));
        if (!isMounted) return;
        setReservations(r);
        setUnits(u);
        setBuildings(b);
        setAreas(areasByBuilding.flat());
        setCreateUnitId((prev) => prev || u[0]?.id || '');
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

  const reload = async () => {
    if (!user) return;
    setActionError(null);
    const r = await reservationsRepo.listForUser(user);
    setReservations(r);
  };

  const areaNameById = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas]);
  const unitLabelById = useMemo(() => new Map(units.map((u) => [u.id, `Depto ${u.number}`])), [units]);
  const buildingNameById = useMemo(() => new Map(buildings.map((b) => [b.id, b.name])), [buildings]);

  const filtered = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return reservations
      .filter((r) => {
        const areaName = areaNameById.get(r.commonAreaId) ?? '';
        const unitLabel = unitLabelById.get(r.unitId) ?? '';
        return (
          areaName.toLowerCase().includes(t) ||
          unitLabel.toLowerCase().includes(t) ||
          labelReservationStatus(r.status).toLowerCase().includes(t)
        );
      })
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }, [reservations, searchTerm, areaNameById, unitLabelById]);

  const canCreate = user?.internalRole === 'OWNER' || user?.internalRole === 'OCCUPANT';

  const actions = canCreate ? (
    <button
      onClick={() => {
        setActionError(null);
        setIsCreateOpen(true);
      }}
      className="flex items-center px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95"
    >
      <Plus className="w-5 h-5 mr-3" /> Nueva reserva
    </button>
  ) : null;

  const submitCreate = async () => {
    if (!user) return;
    if (!createUnitId) {
      setActionError('Selecciona una unidad.');
      return;
    }
    if (!createAreaId) {
      setActionError('Selecciona un área común.');
      return;
    }
    if (!createStartAt || !createEndAt) {
      setActionError('Selecciona fecha y hora.');
      return;
    }

    const unit = units.find((u) => u.id === createUnitId);
    if (!unit) {
      setActionError('Unidad inválida.');
      return;
    }

    try {
      setIsSubmitting(true);
      setActionError(null);
      await reservationsRepo.createForUser(user, {
        buildingId: unit.buildingId,
        unitId: unit.id,
        commonAreaId: createAreaId,
        startAt: new Date(createStartAt).toISOString(),
        endAt: new Date(createEndAt).toISOString(),
      });
      setIsCreateOpen(false);
      setCreateAreaId('');
      setCreateStartAt('');
      setCreateEndAt('');
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos crear la reserva.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelReservation = async (id: string) => {
    if (!user) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      await reservationsRepo.cancelForUser(user, id);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos cancelar la reserva.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedUnit = createUnitId ? units.find((u) => u.id === createUnitId) : undefined;
  const selectedBuildingId = selectedUnit?.buildingId ?? '';
  const availableAreas = selectedBuildingId ? areas.filter((a) => a.buildingId === selectedBuildingId) : [];

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Reservas" description="Reserva áreas comunes según disponibilidad y reglas del edificio" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        {actionError && <ErrorState title="Acción no disponible" description={actionError} />}

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
                    <span className={statusChip(r.status)}>{labelReservationStatus(r.status)}</span>
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                      {unitLabelById.get(r.unitId) ?? r.unitId}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-black text-slate-900">
                    {areaNameById.get(r.commonAreaId) ?? 'Área común'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 font-medium">
                    {buildingNameById.get(r.buildingId) ?? 'Edificio'} · {formatDateTime(r.startAt)} - {formatTime(r.endAt)}
                  </p>
                  {canCreate && r.createdByUserId === user?.id && r.status !== 'CANCELLED' && r.status !== 'REJECTED' && (
                    <div className="mt-4">
                      <button
                        disabled={isSubmitting}
                        onClick={() => cancelReservation(r.id)}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="w-6 h-6 text-primary" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="Cerrar" className="absolute inset-0 bg-black/30" onClick={() => setIsCreateOpen(false)} type="button" />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-black text-slate-900">Nueva reserva</p>
                <p className="mt-1 text-xs text-slate-500 font-medium">Reserva un área común para tu unidad.</p>
              </div>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700">
                Cerrar
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Unidad</label>
                <select
                  value={createUnitId}
                  onChange={(e) => {
                    setCreateUnitId(e.target.value);
                    setCreateAreaId('');
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                >
                  <option value="" disabled>
                    Selecciona...
                  </option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      Depto {u.number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Área común</label>
                <select
                  value={createAreaId}
                  onChange={(e) => setCreateAreaId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                >
                  <option value="" disabled>
                    Selecciona...
                  </option>
                  {availableAreas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Inicio</label>
                  <input
                    type="datetime-local"
                    value={createStartAt}
                    onChange={(e) => setCreateStartAt(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Término</label>
                  <input
                    type="datetime-local"
                    value={createEndAt}
                    onChange={(e) => setCreateEndAt(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={submitCreate}
                className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-black text-sm shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all disabled:opacity-70"
              >
                Reservar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

