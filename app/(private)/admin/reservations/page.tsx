'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { CalendarDays, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import {
  approveReservationForUser,
  cancelReservationForUser,
  listReservationsForUser,
  loadAdminReservationsPageData,
  rejectReservationForUser,
} from '@/lib/features/reservations/reservations-center.data';
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

export default function AdminReservationsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [areas, setAreas] = useState<CommonArea[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setError(null);
        setActionError(null);
        const data = await loadAdminReservationsPageData(user);
        if (!isMounted) return;
        setReservations(data.reservations);
        setUnits(data.units);
        setBuildings(data.buildings);
        setAreas(data.areas);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar las reservas.');
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
    const r = await listReservationsForUser(user);
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
        const buildingName = buildingNameById.get(r.buildingId) ?? '';
        return (
          areaName.toLowerCase().includes(t) ||
          unitLabel.toLowerCase().includes(t) ||
          buildingName.toLowerCase().includes(t) ||
          labelReservationStatus(r.status).toLowerCase().includes(t)
        );
      })
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }, [reservations, searchTerm, areaNameById, unitLabelById, buildingNameById]);

  const canManage = user?.internalRole === 'BUILDING_ADMIN';

  const approve = async (id: string) => {
    if (!user) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      await approveReservationForUser(user, id);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos aprobar la reserva.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reject = async (id: string) => {
    if (!user) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      await rejectReservationForUser(user, id);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos rechazar la reserva.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancel = async (id: string) => {
    if (!user) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      await cancelReservationForUser(user, id);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos cancelar la reserva.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Reservas" description="Gestiona solicitudes de reservas de áreas comunes" />

      <div className="p-6 md:p-8 space-y-6">
        {actionError && <ErrorState title="Acción no disponible" description={actionError} />}

        <div className="relative group max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por área, edificio, depto o estado..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
          />
        </div>

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando reservas..." />
        ) : filtered.length === 0 ? (
          <EmptyState title="Sin reservas" description={searchTerm ? `No hay resultados para "${searchTerm}".` : 'Aún no hay reservas registradas.'} />
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
                  <p className="mt-3 text-sm font-black text-slate-900">{areaNameById.get(r.commonAreaId) ?? 'Área común'}</p>
                  <p className="mt-1 text-xs text-slate-500 font-medium">
                    {buildingNameById.get(r.buildingId) ?? 'Edificio'} · {formatDateTime(r.startAt)} - {formatTime(r.endAt)}
                  </p>

                  {canManage && (
                    <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
                      {r.status === 'REQUESTED' && (
                        <>
                          <button
                            disabled={isSubmitting}
                            onClick={() => approve(r.id)}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all disabled:opacity-60"
                          >
                            Aprobar
                          </button>
                          <button
                            disabled={isSubmitting}
                            onClick={() => reject(r.id)}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all disabled:opacity-60"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      {r.status !== 'CANCELLED' && (
                        <button
                          disabled={isSubmitting}
                          onClick={() => cancel(r.id)}
                          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                      )}
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
    </div>
  );
}

