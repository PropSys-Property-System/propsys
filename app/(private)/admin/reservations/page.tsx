'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState } from '@/components/States';
import { Search, CalendarDays as CalendarIcon, List as ListIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  approveReservationForUser,
  cancelReservationForUser,
  loadAdminReservationsPageData,
  rejectReservationForUser,
  splitReservationsByTimeline,
} from '@/lib/features/reservations/reservations-center.data';
import {
  AdminReservationCard,
  ReservationActionConfirmationDialog,
  ReservationListSkeleton,
  ReservationsCalendarView,
  type ReservationActionKind,
} from '@/lib/features/reservations/reservations-center.ui';
import { Building, CommonArea, Reservation, Unit } from '@/lib/types';

const STATUS_REASON_MIN_LENGTH = 8;
const STATUS_REASON_MAX_LENGTH = 300;

type PendingReservationAction = {
  reservationId: string;
  action: ReservationActionKind;
  areaName: string;
  buildingName: string;
  unitLabel?: string;
  startAt: string;
  endAt: string;
};

export default function AdminReservationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [areas, setAreas] = useState<CommonArea[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [pendingAction, setPendingAction] = useState<PendingReservationAction | null>(null);
  const [pendingActionReason, setPendingActionReason] = useState('');
  const [pendingActionReasonError, setPendingActionReasonError] = useState<string | null>(null);

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

  const validatePendingReason = (action: ReservationActionKind, reason: string) => {
    if (action !== 'REJECT' && action !== 'CANCEL') return null;
    const trimmed = reason.trim();
    if (trimmed.length < STATUS_REASON_MIN_LENGTH) {
      return `El motivo debe tener al menos ${STATUS_REASON_MIN_LENGTH} caracteres.`;
    }
    if (trimmed.length > STATUS_REASON_MAX_LENGTH) {
      return `El motivo no puede superar ${STATUS_REASON_MAX_LENGTH} caracteres.`;
    }
    return null;
  };

  const closePendingActionDialog = () => {
    setPendingAction(null);
    setPendingActionReason('');
    setPendingActionReasonError(null);
  };

  const openConfirmation = (reservation: Reservation, action: ReservationActionKind) => {
    setActionError(null);
    setPendingActionReason('');
    setPendingActionReasonError(null);
    setPendingAction({
      reservationId: reservation.id,
      action,
      areaName: areaNameById.get(reservation.commonAreaId) ?? 'Área común',
      buildingName: buildingNameById.get(reservation.buildingId) ?? 'Edificio',
      unitLabel: unitLabelById.get(reservation.unitId) ?? reservation.unitId,
      startAt: reservation.startAt,
      endAt: reservation.endAt,
    });
  };

  const confirmPendingAction = async () => {
    if (!user || !pendingAction) return;
    const fallbackError =
      pendingAction.action === 'APPROVE'
        ? 'No pudimos aprobar la reserva.'
        : pendingAction.action === 'REJECT'
          ? 'No pudimos rechazar la reserva.'
          : 'No pudimos cancelar la reserva.';
    const reasonError = validatePendingReason(pendingAction.action, pendingActionReason);
    if (reasonError) {
      setPendingActionReasonError(reasonError);
      return;
    }
    const trimmedReason = pendingActionReason.trim();
    try {
      setIsSubmitting(true);
      setActionError(null);
      setPendingActionReasonError(null);
      if (pendingAction.action === 'APPROVE') {
        await approveReservationForUser(user, pendingAction.reservationId);
      } else if (pendingAction.action === 'REJECT') {
        await rejectReservationForUser(user, pendingAction.reservationId, trimmedReason);
      } else {
        await cancelReservationForUser(user, pendingAction.reservationId, trimmedReason);
      }
      await reload();
      router.refresh();
      closePendingActionDialog();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : fallbackError);
      closePendingActionDialog();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Reservas" description="Gestiona solicitudes de reservas de áreas comunes" />

      <div className="p-6 md:p-8 space-y-6">
        {actionError && <ErrorState title="Acción no disponible" description={actionError} />}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative group w-full max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por área, edificio, depto o estado..."
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
          <ReservationListSkeleton />
        ) : viewMode === 'calendar' ? (
          <ReservationsCalendarView
            reservations={reservations}
            areas={areas}
            buildings={buildings}
            units={units}
            currentUserId={user?.id || ''}
            isAdmin={true}
          />
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
                    onApprove={() => openConfirmation(reservation, 'APPROVE')}
                    onReject={() => openConfirmation(reservation, 'REJECT')}
                    onCancel={() => openConfirmation(reservation, 'CANCEL')}
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
                    onApprove={() => openConfirmation(reservation, 'APPROVE')}
                    onReject={() => openConfirmation(reservation, 'REJECT')}
                    onCancel={() => openConfirmation(reservation, 'CANCEL')}
                  />
                ))
              )}
            </section>
          </div>
        )}
      </div>

      <ReservationActionConfirmationDialog
        isOpen={Boolean(pendingAction)}
        isSubmitting={isSubmitting}
        action={pendingAction?.action ?? 'CANCEL'}
        areaName={pendingAction?.areaName ?? 'Área común'}
        buildingName={pendingAction?.buildingName ?? 'Edificio'}
        unitLabel={pendingAction?.unitLabel}
        startAt={pendingAction?.startAt ?? new Date().toISOString()}
        endAt={pendingAction?.endAt ?? new Date().toISOString()}
        reason={pendingActionReason}
        reasonError={pendingActionReasonError}
        onClose={closePendingActionDialog}
        onReasonChange={(value) => {
          setPendingActionReason(value);
          if (pendingActionReasonError) setPendingActionReasonError(null);
        }}
        onConfirm={confirmPendingAction}
      />
    </div>
  );
}
