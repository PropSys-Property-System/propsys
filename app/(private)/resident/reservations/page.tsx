'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import {
  cancelReservationForUser,
  createReservationForUser,
  listReservationsForUser,
  loadResidentReservationsPageData,
} from '@/lib/features/reservations/reservations-center.data';
import { ReservationComposerDialog, ResidentReservationCard } from '@/lib/features/reservations/reservations-center.ui';
import { Building, CommonArea, Reservation, Unit } from '@/lib/types';
import { labelReservationStatus } from '@/lib/presentation/labels';

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
        const data = await loadResidentReservationsPageData(user);
        if (!isMounted) return;
        setReservations(data.reservations);
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
              <ResidentReservationCard
                key={r.id}
                reservation={r}
                areaName={areaNameById.get(r.commonAreaId) ?? 'Area comun'}
                unitLabel={unitLabelById.get(r.unitId) ?? r.unitId}
                buildingName={buildingNameById.get(r.buildingId) ?? 'Edificio'}
                canCancel={Boolean(canCreate && r.createdByUserId === user?.id && r.status !== 'CANCELLED' && r.status !== 'REJECTED')}
                isSubmitting={isSubmitting}
                onCancel={() => cancelReservation(r.id)}
              />
            ))}
          </div>
        )}
      </div>

      <ReservationComposerDialog
        isOpen={isCreateOpen}
        isSubmitting={isSubmitting}
        units={units}
        availableAreas={availableAreas}
        unitId={createUnitId}
        areaId={createAreaId}
        startAt={createStartAt}
        endAt={createEndAt}
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

