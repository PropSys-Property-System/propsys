'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Plus, Search, CalendarDays as CalendarIcon, List as ListIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import {
  cancelReservationForUser,
  createReservationForUser,
  filterAvailableAreasForSlot,
  loadResidentReservationsPageData,
  splitReservationsByTimeline,
} from '@/lib/features/reservations/reservations-center.data';
import { ReservationComposerDialog, ResidentReservationCard, ReservationsCalendarView } from '@/lib/features/reservations/reservations-center.ui';
import { Building, CommonArea, Reservation, Unit } from '@/lib/types';

function toDateTimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ResidentReservationsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [availabilityReservations, setAvailabilityReservations] = useState<Reservation[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [areas, setAreas] = useState<CommonArea[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createUnitId, setCreateUnitId] = useState('');
  const [createAreaId, setCreateAreaId] = useState('');
  const [createStartAt, setCreateStartAt] = useState('');
  const [createEndAt, setCreateEndAt] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setError(null);
        setActionError(null);
        const data = await loadResidentReservationsPageData(user);
        if (!isMounted) return;
        setReservations(data.reservations);
        setAvailabilityReservations(data.availabilityReservations);
        setUnits(data.units);
        setBuildings(data.buildings);
        setAreas(data.areas);
        setCreateUnitId((prev) => prev || data.defaultCreateUnitId);
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
    const data = await loadResidentReservationsPageData(user);
    setReservations(data.reservations);
    setAvailabilityReservations(data.availabilityReservations);
    setUnits(data.units);
    setBuildings(data.buildings);
    setAreas(data.areas);
  };

  const areaNameById = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas]);
  const unitLabelById = useMemo(() => new Map(units.map((u) => [u.id, `Depto ${u.number}`])), [units]);
  const buildingNameById = useMemo(() => new Map(buildings.map((b) => [b.id, b.name])), [buildings]);

  const { active, history } = useMemo(() => {
    const timeline = splitReservationsByTimeline(reservations);
    const search = searchTerm.toLowerCase();
    const matchesText = (reservation: Reservation, displayStatus: string) => {
      const areaName = areaNameById.get(reservation.commonAreaId) ?? '';
      const unitLabel = unitLabelById.get(reservation.unitId) ?? '';
      return (
        areaName.toLowerCase().includes(search) ||
        unitLabel.toLowerCase().includes(search) ||
        displayStatus.toLowerCase().includes(search)
      );
    };

    return {
      active: timeline.active.filter((item) => matchesText(item.reservation, item.displayStatus)),
      history: timeline.history.filter((item) => matchesText(item.reservation, item.displayStatus)),
    };
  }, [reservations, searchTerm, areaNameById, unitLabelById]);

  const canCreate = user?.internalRole === 'OWNER' || user?.internalRole === 'OCCUPANT';
  const now = new Date();
  const minStartAt = toDateTimeLocalValue(now);
  const minEndAt = createStartAt || minStartAt;

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
    if (new Date(createStartAt).getTime() < Date.now()) {
      setActionError('No puedes reservar una fecha u hora anterior a la actual.');
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
      await createReservationForUser(user, {
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
      await cancelReservationForUser(user, id);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos cancelar la reserva.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedUnit = createUnitId ? units.find((u) => u.id === createUnitId) : undefined;
  const selectedBuildingId = selectedUnit?.buildingId ?? '';
  const availableAreas = useMemo(
    () =>
      selectedBuildingId
        ? filterAvailableAreasForSlot(areas, availabilityReservations, selectedBuildingId, createStartAt, createEndAt)
        : [],
    [areas, availabilityReservations, selectedBuildingId, createStartAt, createEndAt]
  );

  useEffect(() => {
    if (createAreaId && !availableAreas.some((area) => area.id === createAreaId)) {
      setCreateAreaId('');
    }
  }, [availableAreas, createAreaId]);

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Reservas" description="Reserva áreas comunes según disponibilidad y reglas del edificio" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        {actionError && <ErrorState title="Acción no disponible" description={actionError} />}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative group w-full max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por área, depto o estado..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            />
          </div>
          
          <div className="flex items-center bg-slate-200/50 p-1 rounded-xl w-fit">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ListIcon className="w-4 h-4 mr-2" /> Lista
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <CalendarIcon className="w-4 h-4 mr-2" /> Calendario
            </button>
          </div>
        </div>

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando reservas..." />
        ) : viewMode === 'calendar' ? (
          <ReservationsCalendarView
            reservations={availabilityReservations}
            areas={areas}
            buildings={buildings}
            units={units}
            currentUserId={user?.id || ''}
            isAdmin={false}
          />
        ) : (
          <div className="max-w-4xl space-y-8">
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Tus reservas</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">Reservas activas o pendientes de gestión.</p>
              </div>
              {active.length === 0 ? (
                <EmptyState
                  title="Sin reservas activas"
                  description={searchTerm ? `No hay resultados activos para "${searchTerm}".` : 'No tienes reservas activas en este momento.'}
                />
              ) : (
                active.map(({ reservation, displayStatus }) => (
                  <ResidentReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    displayStatus={displayStatus}
                    areaName={areaNameById.get(reservation.commonAreaId) ?? 'Área común'}
                    unitLabel={unitLabelById.get(reservation.unitId) ?? reservation.unitId}
                    buildingName={buildingNameById.get(reservation.buildingId) ?? 'Edificio'}
                    canCancel={Boolean(
                      canCreate &&
                        reservation.createdByUserId === user?.id &&
                        reservation.status !== 'CANCELLED' &&
                        reservation.status !== 'REJECTED' &&
                        new Date(reservation.endAt).getTime() >= Date.now()
                    )}
                    isSubmitting={isSubmitting}
                    onCancel={() => cancelReservation(reservation.id)}
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
                  description={searchTerm ? `No hay resultados históricos para "${searchTerm}".` : 'Aún no tienes reservas en el historial.'}
                />
              ) : (
                history.map(({ reservation, displayStatus }) => (
                  <ResidentReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    displayStatus={displayStatus}
                    areaName={areaNameById.get(reservation.commonAreaId) ?? 'Área común'}
                    unitLabel={unitLabelById.get(reservation.unitId) ?? reservation.unitId}
                    buildingName={buildingNameById.get(reservation.buildingId) ?? 'Edificio'}
                    canCancel={false}
                    isSubmitting={isSubmitting}
                    onCancel={() => cancelReservation(reservation.id)}
                  />
                ))
              )}
            </section>
          </div>
        )}
      </div>

      <ReservationComposerDialog
        isOpen={isCreateOpen}
        isSubmitting={isSubmitting}
        units={units}
        availableAreas={availableAreas}
        buildingAreas={selectedBuildingId ? areas.filter((area) => area.buildingId === selectedBuildingId) : []}
        availabilityReservations={availabilityReservations}
        buildingId={selectedBuildingId}
        unitId={createUnitId}
        areaId={createAreaId}
        startAt={createStartAt}
        endAt={createEndAt}
        minStartAt={minStartAt}
        minEndAt={minEndAt}
        onClose={() => setIsCreateOpen(false)}
        onUnitChange={(unitId) => {
          setCreateUnitId(unitId);
          setCreateAreaId('');
        }}
        onAreaChange={setCreateAreaId}
        onStartChange={setCreateStartAt}
        onEndChange={setCreateEndAt}
        onSubmit={submitCreate}
      />
    </div>
  );
}
