'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Search } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import {
  approveReservationForUser,
  cancelReservationForUser,
  loadAdminReservationsPageData,
  rejectReservationForUser,
  splitReservationsByTimeline,
} from '@/lib/features/reservations/reservations-center.data';
import { AdminReservationCard } from '@/lib/features/reservations/reservations-center.ui';
import { Building, CommonArea, Reservation, Unit } from '@/lib/types';

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
    const data = await loadAdminReservationsPageData(user);
    setReservations(data.reservations);
    setUnits(data.units);
    setBuildings(data.buildings);
    setAreas(data.areas);
  };

  const areaNameById = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas]);
  const unitLabelById = useMemo(() => new Map(units.map((u) => [u.id, `Depto ${u.number}`])), [units]);
  const buildingNameById = useMemo(() => new Map(buildings.map((b) => [b.id, b.name])), [buildings]);

  const { active, history } = useMemo(() => {
    const search = searchTerm.toLowerCase();
    const timeline = splitReservationsByTimeline(reservations);
    const matchesText = (reservation: Reservation, displayStatus: string) => {
      const areaName = areaNameById.get(reservation.commonAreaId) ?? '';
      const unitLabel = unitLabelById.get(reservation.unitId) ?? '';
      const buildingName = buildingNameById.get(reservation.buildingId) ?? '';
      return (
        areaName.toLowerCase().includes(search) ||
        unitLabel.toLowerCase().includes(search) ||
        buildingName.toLowerCase().includes(search) ||
        displayStatus.toLowerCase().includes(search)
      );
    };

    return {
      active: timeline.active.filter((item) => matchesText(item.reservation, item.displayStatus)),
      history: timeline.history.filter((item) => matchesText(item.reservation, item.displayStatus)),
    };
  }, [reservations, searchTerm, areaNameById, unitLabelById, buildingNameById]);

  const canManage =
    user?.internalRole === 'BUILDING_ADMIN' || user?.internalRole === 'CLIENT_MANAGER' || user?.internalRole === 'ROOT_ADMIN';

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
        ) : (
          <div className="max-w-4xl space-y-8">
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Reservas activas</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">Solicitadas o aprobadas pendientes de ejecución.</p>
              </div>
              {active.length === 0 ? (
                <EmptyState
                  title="Sin reservas activas"
                  description={searchTerm ? `No hay resultados activos para "${searchTerm}".` : 'No hay reservas activas registradas.'}
                />
              ) : (
                active.map(({ reservation, displayStatus }) => (
                  <AdminReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    displayStatus={displayStatus}
                    areaName={areaNameById.get(reservation.commonAreaId) ?? 'Área común'}
                    unitLabel={unitLabelById.get(reservation.unitId) ?? reservation.unitId}
                    buildingName={buildingNameById.get(reservation.buildingId) ?? 'Edificio'}
                    canManage={Boolean(canManage)}
                    isSubmitting={isSubmitting}
                    onApprove={() => approve(reservation.id)}
                    onReject={() => reject(reservation.id)}
                    onCancel={() => cancel(reservation.id)}
                  />
                ))
              )}
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Historial</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">Reservas finalizadas, canceladas o rechazadas.</p>
              </div>
              {history.length === 0 ? (
                <EmptyState
                  title="Sin historial"
                  description={searchTerm ? `No hay resultados históricos para "${searchTerm}".` : 'No hay reservas en historial todavía.'}
                />
              ) : (
                history.map(({ reservation, displayStatus }) => (
                  <AdminReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    displayStatus={displayStatus}
                    areaName={areaNameById.get(reservation.commonAreaId) ?? 'Área común'}
                    unitLabel={unitLabelById.get(reservation.unitId) ?? reservation.unitId}
                    buildingName={buildingNameById.get(reservation.buildingId) ?? 'Edificio'}
                    canManage={Boolean(canManage)}
                    isSubmitting={isSubmitting}
                    onApprove={() => approve(reservation.id)}
                    onReject={() => reject(reservation.id)}
                    onCancel={() => cancel(reservation.id)}
                  />
                ))
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
