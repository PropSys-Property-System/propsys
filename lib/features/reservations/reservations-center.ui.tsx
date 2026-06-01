import React, { useState, useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateTime, formatTime } from '@/lib/presentation/dates';
import { labelReservationStatus } from '@/lib/presentation/labels';
import type { ReservationDisplayStatus } from '@/lib/features/reservations/reservations-center.data';
import type { CommonArea, Reservation, Unit, Building } from '@/lib/types';
import { getStartOfWeek, getWeekDays, formatReservationTimeRange, groupReservationsByDay, isReservationInWeek } from './reservations-calendar.utils';

const STATUS_REASON_MIN_LENGTH = 8;
const STATUS_REASON_MAX_LENGTH = 300;

type AdminReservationCardProps = {
  reservation: Reservation;
  displayStatus: ReservationDisplayStatus;
  areaName: string;
  unitLabel: string;
  buildingName: string;
  canManage: boolean;
  isSubmitting: boolean;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
};

type ResidentReservationCardProps = {
  reservation: Reservation;
  displayStatus: ReservationDisplayStatus;
  areaName: string;
  unitLabel: string;
  buildingName: string;
  canCancel: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
};

type ReservationComposerDialogProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  units: Unit[];
  availableAreas: CommonArea[];
  buildingAreas: CommonArea[];
  availabilityReservations: Reservation[];
  buildingId: string;
  unitId: string;
  areaId: string;
  startAt: string;
  endAt: string;
  minStartAt?: string;
  minEndAt?: string;
  onClose: () => void;
  onUnitChange: (unitId: string) => void;
  onAreaChange: (areaId: string) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onSubmit: () => void;
};

export type ReservationActionKind = 'APPROVE' | 'REJECT' | 'CANCEL';

type ReservationActionConfirmationDialogProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  action: ReservationActionKind;
  areaName: string;
  buildingName: string;
  unitLabel?: string;
  startAt: string;
  endAt: string;
  reason: string;
  reasonError?: string | null;
  onClose: () => void;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
};

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

function sameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function buildTimeSlots(baseDate: Date) {
  const slots: Array<{ start: Date; end: Date; key: string; label: string }> = [];

  for (let hour = 6; hour < 23; hour += 1) {
    const start = new Date(baseDate);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(baseDate);
    end.setHours(hour + 1, 0, 0, 0);
    const label = `${String(hour).padStart(2, '0')}:00`;
    slots.push({ start, end, key: label, label });
  }

  return slots;
}

function ReservationAvailabilityBoard({
  buildingAreas,
  reservations,
  buildingId,
  selectedAreaId,
  startAt,
  endAt,
}: {
  buildingAreas: CommonArea[];
  reservations: Reservation[];
  buildingId: string;
  selectedAreaId: string;
  startAt: string;
  endAt: string;
}) {
  if (!buildingId) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-medium text-slate-500">
        Selecciona una unidad para ver la disponibilidad del edificio.
      </div>
    );
  }

  if (!startAt || !endAt) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-medium text-slate-500">
        Elige fecha y horario para ver la agenda de áreas comunes.
      </div>
    );
  }

  const requestedStart = new Date(startAt);
  const requestedEnd = new Date(endAt);
  if (Number.isNaN(requestedStart.getTime()) || Number.isNaN(requestedEnd.getTime()) || requestedStart >= requestedEnd) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-medium text-slate-500">
        Ajusta un rango horario valido para revisar la disponibilidad.
      </div>
    );
  }

  const scheduleAreas = buildingAreas.filter((area) => area.buildingId === buildingId);
  const slots = buildTimeSlots(requestedStart);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Agenda visual</p>
        <p className="mt-1 text-xs font-medium text-slate-500">
          Gris: disponible. Rosa: ocupado. Verde: tramo que estas intentando reservar.
        </p>
      </div>

      <div className="space-y-3">
        {scheduleAreas.map((area) => {
          const areaReservations = reservations.filter((reservation) => {
            if (reservation.buildingId !== buildingId) return false;
            if (reservation.commonAreaId !== area.id) return false;
            if (reservation.status === 'CANCELLED' || reservation.status === 'REJECTED') return false;
            const reservationStart = new Date(reservation.startAt);
            return sameCalendarDay(reservationStart, requestedStart);
          });

          return (
            <div key={area.id} className={`rounded-xl border px-3 py-3 ${selectedAreaId === area.id ? 'border-emerald-200 bg-white' : 'border-slate-200 bg-white'}`}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="truncate text-sm font-black text-slate-800">{area.name}</p>
                {selectedAreaId === area.id ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                    Seleccionada
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {slots.map((slot) => {
                  const isRequested =
                    selectedAreaId === area.id && overlaps(slot.start, slot.end, requestedStart, requestedEnd);
                  const isOccupied = areaReservations.some((reservation) =>
                    overlaps(slot.start, slot.end, new Date(reservation.startAt), new Date(reservation.endAt))
                  );

                  let classes = 'border-slate-200 bg-slate-100 text-slate-500';
                  if (isOccupied) classes = 'border-rose-200 bg-rose-50 text-rose-700';
                  if (isRequested) classes = 'border-emerald-200 bg-emerald-50 text-emerald-700';

                  return (
                    <div key={`${area.id}-${slot.key}`} className={`rounded-lg border px-2 py-2 text-center ${classes}`}>
                      <p className="text-[11px] font-black">{slot.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function labelReservationDisplayStatus(status: ReservationDisplayStatus) {
  return status === 'COMPLETED' ? 'Finalizada' : labelReservationStatus(status);
}

function reservationActionDialogCopy(action: ReservationActionKind) {
  if (action === 'APPROVE') {
    return {
      title: 'Confirmar aprobación',
      summaryAction: 'Aprobar reserva',
      description: 'Vas a aprobar esta reserva y mantener el flujo actual de gestión.',
      confirmLabel: 'Confirmar aprobación',
    };
  }

  if (action === 'REJECT') {
    return {
      title: 'Confirmar rechazo',
      summaryAction: 'Rechazar reserva',
      description: 'Vas a rechazar esta reserva y el cambio se aplicará de inmediato.',
      confirmLabel: 'Confirmar rechazo',
    };
  }

  return {
    title: 'Confirmar cancelación',
    summaryAction: 'Cancelar reserva',
    description: 'Vas a cancelar esta reserva y el cambio se aplicará de inmediato.',
    confirmLabel: 'Confirmar cancelación',
  };
}

function getReasonValidationError(reason: string) {
  const trimmedLength = reason.trim().length;
  if (trimmedLength === 0) return 'Debes ingresar un motivo.';
  if (trimmedLength < STATUS_REASON_MIN_LENGTH) {
    return `El motivo debe tener al menos ${STATUS_REASON_MIN_LENGTH} caracteres.`;
  }
  if (trimmedLength > STATUS_REASON_MAX_LENGTH) {
    return `El motivo no puede superar ${STATUS_REASON_MAX_LENGTH} caracteres.`;
  }
  return null;
}

function reservationReasonPlaceholder(action: ReservationActionKind) {
  if (action === 'REJECT') {
    return 'Ej. El área común no está disponible por mantenimiento.';
  }
  return 'Ej. El residente solicitó cancelar la reserva.';
}

export function reservationStatusChip(status: ReservationDisplayStatus) {
  const base = 'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest';
  if (status === 'REQUESTED') return `${base} bg-amber-50 text-amber-700`;
  if (status === 'APPROVED') return `${base} bg-emerald-50 text-emerald-700`;
  if (status === 'REJECTED') return `${base} bg-rose-50 text-rose-700`;
  if (status === 'COMPLETED') return `${base} bg-sky-50 text-sky-700`;
  return `${base} bg-slate-100 text-slate-600`;
}

export function AdminReservationCard({
  reservation,
  displayStatus,
  areaName,
  unitLabel,
  buildingName,
  canManage,
  isSubmitting,
  onApprove,
  onReject,
  onCancel,
}: AdminReservationCardProps) {
  const canManageRequest = reservation.status === 'REQUESTED';
  const canCancelReservation =
    (reservation.status === 'REQUESTED' || reservation.status === 'APPROVED') && displayStatus !== 'COMPLETED';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={reservationStatusChip(displayStatus)}>{labelReservationDisplayStatus(displayStatus)}</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
            {unitLabel}
          </span>
        </div>
        <p className="mt-3 text-sm font-black text-slate-900">{areaName}</p>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          {buildingName} · {formatDateTime(reservation.startAt)} - {formatTime(reservation.endAt)}
        </p>
        {(reservation.status === 'REJECTED' || reservation.status === 'CANCELLED') && reservation.statusReason ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Motivo</p>
            <p className="mt-1 text-sm font-medium text-slate-700">{reservation.statusReason}</p>
          </div>
        ) : null}

        {canManage ? (
          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
            {canManageRequest ? (
              <>
                <button
                  disabled={isSubmitting}
                  onClick={onApprove}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all disabled:opacity-60"
                >
                  Aprobar
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={onReject}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all disabled:opacity-60"
                >
                  Rechazar
                </button>
              </>
            ) : null}
            {canCancelReservation ? (
              <button
                disabled={isSubmitting}
                onClick={onCancel}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all disabled:opacity-60"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
        <CalendarDays className="w-6 h-6 text-primary" />
      </div>
    </div>
  );
}

export function ResidentReservationCard({
  reservation,
  displayStatus,
  areaName,
  unitLabel,
  buildingName,
  canCancel,
  isSubmitting,
  onCancel,
}: ResidentReservationCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={reservationStatusChip(displayStatus)}>{labelReservationDisplayStatus(displayStatus)}</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
            {unitLabel}
          </span>
        </div>
        <p className="mt-3 text-sm font-black text-slate-900">{areaName}</p>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          {buildingName} · {formatDateTime(reservation.startAt)} - {formatTime(reservation.endAt)}
        </p>
        {(reservation.status === 'REJECTED' || reservation.status === 'CANCELLED') && reservation.statusReason ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Motivo</p>
            <p className="mt-1 text-sm font-medium text-slate-700">{reservation.statusReason}</p>
          </div>
        ) : null}
        {canCancel ? (
          <div className="mt-4">
            <button
              disabled={isSubmitting}
              onClick={onCancel}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        ) : null}
      </div>
      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
        <CalendarDays className="w-6 h-6 text-primary" />
      </div>
    </div>
  );
}

export function ReservationActionConfirmationDialog({
  isOpen,
  isSubmitting,
  action,
  areaName,
  buildingName,
  unitLabel,
  startAt,
  endAt,
  reason,
  reasonError,
  onClose,
  onReasonChange,
  onConfirm,
}: ReservationActionConfirmationDialogProps) {
  if (!isOpen) return null;

  const copy = reservationActionDialogCopy(action);
  const requiresReason = action === 'REJECT' || action === 'CANCEL';
  const inlineReasonError = requiresReason ? getReasonValidationError(reason) : null;
  const displayedReasonError = reasonError ?? inlineReasonError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cerrar" className="absolute inset-0 bg-black/30" onClick={onClose} type="button" />
      <div role="dialog" aria-modal="true" aria-labelledby="reservation-action-confirmation-title" className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p id="reservation-action-confirmation-title" className="text-lg font-black text-slate-900">
              {copy.title}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">{copy.description}</p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700">
            Cerrar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Resumen</p>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Acción</dt>
              <dd className="mt-1 font-bold text-slate-900">{copy.summaryAction}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Área común</dt>
              <dd className="mt-1 font-bold text-slate-900">{areaName}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Edificio</dt>
              <dd className="mt-1 font-bold text-slate-900">{buildingName}</dd>
            </div>
            {unitLabel ? (
              <div>
                <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Unidad</dt>
                <dd className="mt-1 font-bold text-slate-900">{unitLabel}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Fecha y horario</dt>
              <dd className="mt-1 font-bold text-slate-900">
                {formatDateTime(startAt)} - {formatTime(endAt)}
              </dd>
            </div>
          </dl>
        </div>

        {requiresReason ? (
          <div className="mt-5">
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400" htmlFor="reservation-status-reason">
              Motivo
            </label>
            <textarea
              id="reservation-status-reason"
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              rows={4}
              placeholder={reservationReasonPlaceholder(action)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/5"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className={`text-xs font-bold ${displayedReasonError ? 'text-rose-600' : 'text-slate-400'}`}>
                {displayedReasonError ?? `Entre ${STATUS_REASON_MIN_LENGTH} y ${STATUS_REASON_MAX_LENGTH} caracteres.`}
              </p>
              <p className="text-xs font-bold text-slate-400">{reason.trim().length}/{STATUS_REASON_MAX_LENGTH}</p>
            </div>
          </div>
        ) : null}

        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-6 py-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition-all hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSubmitting || (requiresReason && Boolean(inlineReasonError))}
            onClick={onConfirm}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition-all hover:bg-slate-800 disabled:opacity-70"
          >
            {copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReservationComposerDialog({
  isOpen,
  isSubmitting,
  units,
  availableAreas,
  buildingAreas,
  availabilityReservations,
  buildingId,
  unitId,
  areaId,
  startAt,
  endAt,
  minStartAt,
  minEndAt,
  onClose,
  onUnitChange,
  onAreaChange,
  onStartChange,
  onEndChange,
  onSubmit,
}: ReservationComposerDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cerrar" className="absolute inset-0 bg-black/30" onClick={onClose} type="button" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-lg font-black text-slate-900">Nueva reserva</p>
            <p className="mt-1 text-xs text-slate-500 font-medium">Reserva un área común para tu unidad.</p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700">
            Cerrar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Unidad</label>
            <select
              value={unitId}
              onChange={(event) => onUnitChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            >
              <option value="" disabled>
                Selecciona...
              </option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  Depto {unit.number}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Área común</label>
            <select
              value={areaId}
              onChange={(event) => onAreaChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            >
              <option value="" disabled>
                Selecciona...
              </option>
              {availableAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
            {startAt && endAt && availableAreas.length === 0 ? (
              <p className="mt-2 text-xs font-bold text-slate-400">No hay áreas disponibles para esa fecha y horario.</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Inicio</label>
              <input
                type="datetime-local"
                value={startAt}
                min={minStartAt}
                onChange={(event) => onStartChange(event.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Termino</label>
              <input
                type="datetime-local"
                value={endAt}
                min={minEndAt}
                onChange={(event) => onEndChange(event.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              />
            </div>
          </div>

          <ReservationAvailabilityBoard
            buildingAreas={buildingAreas}
            reservations={availabilityReservations}
            buildingId={buildingId}
            selectedAreaId={areaId}
            startAt={startAt}
            endAt={endAt}
          />
        </div>
        </div>

        <div className="border-t border-slate-100 bg-white px-6 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onSubmit}
            className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-black text-sm shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all disabled:opacity-70"
          >
            Reservar
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type ReservationsCalendarViewProps = {
  reservations: Reservation[];
  areas: CommonArea[];
  buildings: Building[];
  units: Unit[];
  currentUserId: string;
  isAdmin: boolean;
};

function ReservationCalendarLegend() {
  const items = [
    { label: 'Aprobada', classes: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
    { label: 'Solicitada', classes: 'bg-amber-50 border-amber-200 text-amber-800' },
    { label: 'Ocupado', classes: 'bg-slate-100 border-slate-200 text-slate-700' },
  ];

  return (
    <div className="px-4 md:px-6 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Leyenda</span>
        {items.map((item) => (
          <span
            key={item.label}
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${item.classes}`}
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ReservationsCalendarView({
  reservations,
  areas,
  buildings,
  units,
  currentUserId,
  isAdmin,
}: ReservationsCalendarViewProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getStartOfWeek(new Date()));
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');

  const weekDays = useMemo(() => getWeekDays(currentWeekStart), [currentWeekStart]);

  const goToPreviousWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() - 7);
    setCurrentWeekStart(next);
  };

  const goToNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const goToToday = () => {
    setCurrentWeekStart(getStartOfWeek(new Date()));
  };

  // Filtrar reservas
  const visibleReservations = useMemo(() => {
    return reservations.filter(r => {
      // Regla de privacidad y estados cancelados:
      if (r.status === 'CANCELLED' || r.status === 'REJECTED') return false;

      // Filtro de UI
      if (selectedBuildingId && r.buildingId !== selectedBuildingId) return false;
      if (selectedAreaId && r.commonAreaId !== selectedAreaId) return false;

      // Filtro de semana
      if (!isReservationInWeek(r, currentWeekStart)) return false;

      return true;
    });
  }, [reservations, selectedBuildingId, selectedAreaId, currentWeekStart]);

  const groupedReservations = useMemo(() => groupReservationsByDay(visibleReservations), [visibleReservations]);

  const areaNameById = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas]);
  const unitLabelById = useMemo(() => new Map(units.map((u) => [u.id, `Depto ${u.number}`])), [units]);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
      <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            aria-label="Semana anterior"
            title="Semana anterior"
            onClick={goToPreviousWeek}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <button onClick={goToToday} className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm font-bold text-slate-700">
            Hoy
          </button>
          <button
            aria-label="Semana siguiente"
            title="Semana siguiente"
            onClick={goToNextWeek}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <select 
            value={selectedBuildingId} 
            onChange={(e) => { setSelectedBuildingId(e.target.value); setSelectedAreaId(''); }}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Todos los edificios</option>
            {buildings.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select 
            value={selectedAreaId} 
            onChange={(e) => setSelectedAreaId(e.target.value)}
            disabled={!selectedBuildingId}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          >
            <option value="">Todas las áreas comunes</option>
            {areas.filter(a => a.buildingId === selectedBuildingId).map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      <ReservationCalendarLegend />

      <div className="overflow-x-auto">
        <div className="min-w-[800px] grid grid-cols-7 divide-x divide-slate-100 border-b border-slate-100">
          {weekDays.map((day, idx) => {
            const isToday = new Date().toDateString() === day.toDateString();
            const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
            const dayReservations = groupedReservations.get(dateKey) || [];

            return (
              <div key={idx} className="min-h-[500px] flex flex-col">
                <div className={`p-3 border-b border-slate-100 text-center ${isToday ? 'bg-primary/5' : 'bg-slate-50/50'}`}>
                  <p className={`text-xs font-black uppercase tracking-widest ${isToday ? 'text-primary' : 'text-slate-500'}`}>
                    {day.toLocaleDateString('es-ES', { weekday: 'short' })}
                  </p>
                  <p className={`mt-1 text-lg font-black ${isToday ? 'text-primary' : 'text-slate-900'}`}>
                    {day.getDate()}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    {day.toLocaleDateString('es-ES', { month: 'short' })}
                  </p>
                </div>
                
                <div className="flex-1 p-2 space-y-2 bg-slate-50/20">
                  {dayReservations.map(r => {
                    const isOwner = r.createdByUserId === currentUserId;
                    const canSeeDetails = isAdmin || isOwner;
                    const timeRange = formatReservationTimeRange(r.startAt, r.endAt);
                    
                    let bgColor = 'bg-white border-slate-200';
                    let textColor = 'text-slate-700';
                    if (r.status === 'REQUESTED') {
                      bgColor = 'bg-amber-50 border-amber-200';
                      textColor = 'text-amber-800';
                    } else if (r.status === 'APPROVED') {
                      bgColor = 'bg-emerald-50 border-emerald-200';
                      textColor = 'text-emerald-800';
                    }

                    if (!canSeeDetails) {
                      return (
                        <div key={r.id} className="p-2.5 rounded-xl border border-slate-200 bg-slate-100">
                          <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Ocupado</p>
                          <p className="mt-1 text-xs font-bold text-slate-600 break-words">
                            {areaNameById.get(r.commonAreaId) || 'Área común'}
                          </p>
                          <p className="text-xs font-medium text-slate-400 mt-1">{timeRange}</p>
                        </div>
                      );
                    }

                    return (
                      <div key={r.id} className={`p-2.5 rounded-xl border shadow-sm ${bgColor}`}>
                        <p className={`text-xs font-black truncate ${textColor}`}>
                          {areaNameById.get(r.commonAreaId) || 'Área'}
                        </p>
                        <p className="text-[11px] font-bold text-slate-500 mt-1">{timeRange}</p>
                        {isAdmin && (
                          <p className="text-[10px] font-bold text-slate-400 truncate mt-1">
                            {unitLabelById.get(r.unitId)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
