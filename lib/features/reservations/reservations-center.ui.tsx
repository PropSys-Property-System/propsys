import { CalendarDays } from 'lucide-react';
import { formatDateTime, formatTime } from '@/lib/presentation/dates';
import { labelReservationStatus } from '@/lib/presentation/labels';
import type { CommonArea, Reservation, Unit } from '@/lib/types';

type AdminReservationCardProps = {
  reservation: Reservation;
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
  unitId: string;
  areaId: string;
  startAt: string;
  endAt: string;
  onClose: () => void;
  onUnitChange: (unitId: string) => void;
  onAreaChange: (areaId: string) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onSubmit: () => void;
};

export function reservationStatusChip(status: Reservation['status']) {
  const base = 'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest';
  if (status === 'REQUESTED') return `${base} bg-amber-50 text-amber-700`;
  if (status === 'APPROVED') return `${base} bg-emerald-50 text-emerald-700`;
  if (status === 'REJECTED') return `${base} bg-rose-50 text-rose-700`;
  return `${base} bg-slate-100 text-slate-600`;
}

export function AdminReservationCard({
  reservation,
  areaName,
  unitLabel,
  buildingName,
  canManage,
  isSubmitting,
  onApprove,
  onReject,
  onCancel,
}: AdminReservationCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={reservationStatusChip(reservation.status)}>{labelReservationStatus(reservation.status)}</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
            {unitLabel}
          </span>
        </div>
        <p className="mt-3 text-sm font-black text-slate-900">{areaName}</p>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          {buildingName} · {formatDateTime(reservation.startAt)} - {formatTime(reservation.endAt)}
        </p>

        {canManage ? (
          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
            {reservation.status === 'REQUESTED' ? (
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
            {reservation.status !== 'CANCELLED' ? (
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
          <span className={reservationStatusChip(reservation.status)}>{labelReservationStatus(reservation.status)}</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
            {unitLabel}
          </span>
        </div>
        <p className="mt-3 text-sm font-black text-slate-900">{areaName}</p>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          {buildingName} · {formatDateTime(reservation.startAt)} - {formatTime(reservation.endAt)}
        </p>
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

export function ReservationComposerDialog({
  isOpen,
  isSubmitting,
  units,
  availableAreas,
  unitId,
  areaId,
  startAt,
  endAt,
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
      <div role="dialog" aria-modal="true" className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-black text-slate-900">Nueva reserva</p>
            <p className="mt-1 text-xs text-slate-500 font-medium">Reserva un área común para tu unidad.</p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700">
            Cerrar
          </button>
        </div>

        <div className="mt-5 space-y-3">
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Inicio</label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(event) => onStartChange(event.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Termino</label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(event) => onEndChange(event.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
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
  );
}
