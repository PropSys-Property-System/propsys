import { Wrench } from 'lucide-react';
import { formatDateTime } from '@/lib/presentation/dates';
import { labelClient, labelIncidentPriority, labelIncidentStatus } from '@/lib/presentation/labels';
import type { IncidentEntity } from '@/lib/types';
import type { TicketBuildingOption, TicketStaffOption, TicketUnitOption, TicketWithEvidence } from '@/lib/features/tickets/ticket-center.data';

export type IncidentReportContext = {
  reportFrom: string;
  problemType: string;
  whereOccurs: string;
  locationDetail: string;
  since: string;
  impact: string;
  additionalDetail: string;
};

export function buildStructuredDescription(context: IncidentReportContext): string {
  const lines = [
    `Reportado desde: ${context.reportFrom}`,
    `Tipo de problema: ${context.problemType}`,
    `Dónde ocurre: ${context.whereOccurs}`,
    `Lugar específico: ${context.locationDetail}`,
    `Desde cuándo ocurre: ${context.since}`,
    `Afectación: ${context.impact}`,
  ];
  const detail = context.additionalDetail.trim();
  if (detail) {
    lines.push('');
    lines.push('---');
    lines.push('Detalle adicional:');
    lines.push(detail);
  }
  return lines.join('\n');
}

export function getSuggestedIncidentTitle(problemType: string, whereOccurs: string) {
  if (!problemType || !whereOccurs) return '';
  if (problemType === 'Otro' || whereOccurs === 'Otro') return 'Incidencia reportada';
  return `${problemType} en ${whereOccurs}`;
}

type AdminTicketCardProps = {
  ticket: TicketWithEvidence;
  buildingName: string;
  unitLabel?: string | null;
  canUpdate: boolean;
  isSubmitting: boolean;
  selectedStatus: IncidentEntity['status'] | '';
  allStatuses: IncidentEntity['status'][];
  staffOptions: TicketStaffOption[];
  selectedAssignee: string | '';
  onStatusChange: (status: IncidentEntity['status']) => void;
  onSaveStatus: () => void;
  onCloseIncident: () => void;
  onAssigneeChange: (userId: string) => void;
  onAssign: () => void;
};

type IncidentCloseConfirmationDialogProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  title: string;
  buildingName: string;
  unitLabel?: string | null;
  assigneeName?: string | null;
  currentStatus: IncidentEntity['status'];
  onClose: () => void;
  onConfirm: () => void;
};

type TicketComposerDialogProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  buildings: TicketBuildingOption[];
  units: TicketUnitOption[];
  buildingId: string;
  unitId: string;
  title: string;
  description: string;
  priority: IncidentEntity['priority'];
  onClose: () => void;
  onBuildingChange: (buildingId: string) => void;
  onUnitChange: (unitId: string) => void;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onPriorityChange: (priority: IncidentEntity['priority']) => void;
  onSubmit: () => void;
};

type ResidentTicketCardProps = {
  ticket: TicketWithEvidence;
};

type ResidentTicketComposerDialogProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  units: TicketUnitOption[];
  buildingNameById: ReadonlyMap<string, string>;
  unitId: string;
  problemType: string;
  whereOccurs: string;
  locationDetail: string;
  since: string;
  impact: string;
  title: string;
  additionalDetail: string;
  priority: IncidentEntity['priority'];
  error?: string | null;
  onClose: () => void;
  onUnitChange: (unitId: string) => void;
  onProblemTypeChange: (value: string) => void;
  onWhereOccursChange: (value: string) => void;
  onLocationDetailChange: (value: string) => void;
  onSinceChange: (value: string) => void;
  onImpactChange: (value: string) => void;
  onTitleChange: (title: string) => void;
  onAdditionalDetailChange: (value: string) => void;
  onPriorityChange: (priority: IncidentEntity['priority']) => void;
  evidenceFile: File | null;
  onEvidenceChange: (file: File | null) => void;
  onSubmit: () => void;
};

type StaffTicketCardProps = {
  ticket: TicketWithEvidence;
  buildingName: string;
  unitLabel?: string | null;
  isSubmitting: boolean;
  selectedStatus: IncidentEntity['status'] | '';
  allowedStatuses: IncidentEntity['status'][];
  onStatusChange: (status: IncidentEntity['status']) => void;
  onSaveStatus: () => void;
};

type StaffTicketComposerDialogProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  units: TicketUnitOption[];
  unitId: string;
  title: string;
  description: string;
  priority: IncidentEntity['priority'];
  onClose: () => void;
  onUnitChange: (unitId: string) => void;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onPriorityChange: (priority: IncidentEntity['priority']) => void;
  onSubmit: () => void;
};

export function incidentStatusChip(status: IncidentEntity['status']) {
  const base = 'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest';
  if (status === 'REPORTED') return `${base} bg-rose-50 text-rose-700`;
  if (status === 'ASSIGNED' || status === 'IN_PROGRESS') return `${base} bg-amber-50 text-amber-700`;
  if (status === 'RESOLVED') return `${base} bg-emerald-50 text-emerald-700`;
  return `${base} bg-slate-100 text-slate-600`;
}

export function incidentPriorityChip(priority: IncidentEntity['priority']) {
  const base = 'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest';
  if (priority === 'HIGH') return `${base} bg-rose-50 text-rose-700`;
  if (priority === 'MEDIUM') return `${base} bg-amber-50 text-amber-700`;
  return `${base} bg-slate-100 text-slate-600`;
}

export function AdminTicketCard({
  ticket,
  buildingName,
  unitLabel,
  canUpdate,
  isSubmitting,
  selectedStatus,
  allStatuses,
  staffOptions,
  selectedAssignee,
  onStatusChange,
  onSaveStatus,
  onCloseIncident,
  onAssigneeChange,
  onAssign,
}: AdminTicketCardProps) {
  const currentAssignee = staffOptions.find((staff) => staff.id === ticket.assignedToUserId);
  const availableStatuses = allStatuses.filter((status) => status !== 'ASSIGNED' || Boolean(ticket.assignedToUserId));

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={incidentStatusChip(ticket.status)}>{labelIncidentStatus(ticket.status)}</span>
          <span className={incidentPriorityChip(ticket.priority)}>{labelIncidentPriority(ticket.priority)}</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
            {labelClient(ticket.clientId)}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
            {buildingName}
          </span>
          {unitLabel && (
            <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
              Unidad {unitLabel}
            </span>
          )}
        </div>
        <p className="mt-3 text-sm font-black text-slate-900 truncate">{ticket.title}</p>
        <p className="mt-1 text-xs text-slate-500 font-medium line-clamp-2">{ticket.description}</p>
        <p className="mt-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Creado {formatDateTime(ticket.createdAt)}</p>
        {currentAssignee ? (
          <p className="mt-2 text-xs font-bold text-slate-600">
            Responsable: <span className="text-slate-800">{currentAssignee.name}</span>
          </p>
        ) : null}

        {ticket.evidence && ticket.evidence.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {ticket.evidence.map((ev) => (
              <a
                key={ev.id}
                href={ev.publicPath || ev.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-3 py-1.5 rounded-xl bg-primary/5 text-primary text-xs font-bold hover:bg-primary/10 transition-colors"
              >
                Ver evidencia adjunta
              </a>
            ))}
          </div>
        )}

        {canUpdate && (
          <div className="mt-4 space-y-3">
            {staffOptions.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                <span className="text-xs font-bold text-amber-700">Responsable:</span>
                <select
                  value={selectedAssignee}
                  onChange={(event) => onAssigneeChange(event.target.value)}
                  className="flex-1 px-4 py-2 bg-white border border-amber-200 rounded-xl focus:ring-4 focus:ring-amber/5 focus:border-amber outline-none transition-all text-xs font-bold"
                >
                  <option value="" disabled>
                    Seleccionar responsable...
                  </option>
                  {staffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} · {staff.role}
                    </option>
                  ))}
                </select>
                <button
                  disabled={!selectedAssignee || isSubmitting}
                  onClick={onAssign}
                  className="px-4 py-2 bg-amber-600 text-white rounded-xl font-bold text-xs hover:bg-amber-700 transition-all disabled:opacity-60"
                >
                  {ticket.assignedToUserId ? 'Reasignar' : 'Asignar'}
                </button>
              </div>
            )}

            {/* Cambio de estado */}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <select
                value={selectedStatus}
                onChange={(event) => onStatusChange(event.target.value as IncidentEntity['status'])}
                className="w-full sm:w-56 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-xs font-bold"
              >
                <option value="" disabled>
                  Cambiar estado...
                </option>
                {availableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {labelIncidentStatus(status)}
                  </option>
                ))}
              </select>
              <button
                disabled={!selectedStatus || isSubmitting}
                onClick={onSaveStatus}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all disabled:opacity-60"
              >
                Guardar
              </button>
              <button
                disabled={isSubmitting || ticket.status === 'CLOSED'}
                onClick={onCloseIncident}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all disabled:opacity-60"
              >
                Cerrar incidencia
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
        <Wrench className="w-6 h-6 text-primary" />
      </div>
    </div>
  );
}

export function IncidentCloseConfirmationDialog({
  isOpen,
  isSubmitting,
  title,
  buildingName,
  unitLabel,
  assigneeName,
  currentStatus,
  onClose,
  onConfirm,
}: IncidentCloseConfirmationDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cerrar" className="absolute inset-0 bg-black/30" onClick={onClose} type="button" />
      <div role="dialog" aria-modal="true" aria-labelledby="incident-close-confirmation-title" className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p id="incident-close-confirmation-title" className="text-lg font-black text-slate-900">
              Confirmar cierre de incidencia
            </p>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Vas a cerrar esta incidencia. Este cambio marcara el reporte como cerrado.
            </p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700">
            Cerrar
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Resumen</p>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Titulo</dt>
              <dd className="mt-1 font-bold text-slate-900">{title}</dd>
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
            {assigneeName ? (
              <div>
                <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Responsable</dt>
                <dd className="mt-1 font-bold text-slate-900">{assigneeName}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Estado actual</dt>
              <dd className="mt-1 font-bold text-slate-900">{labelIncidentStatus(currentStatus)}</dd>
            </div>
          </dl>
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
            onClick={onConfirm}
            className="px-5 py-3 rounded-xl bg-slate-900 text-white font-black text-sm hover:bg-slate-800 transition-all disabled:opacity-70"
          >
            Confirmar cierre
          </button>
        </div>
      </div>
    </div>
  );
}

export function ResidentTicketCard({ ticket }: ResidentTicketCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={incidentStatusChip(ticket.status)}>{labelIncidentStatus(ticket.status)}</span>
          <span className={incidentPriorityChip(ticket.priority)}>{labelIncidentPriority(ticket.priority)}</span>
        </div>
        <p className="mt-3 text-sm font-black text-slate-900">{ticket.title}</p>
        <p className="mt-2 text-xs text-slate-500 font-medium">{ticket.description}</p>
        <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
          {formatDateTime(ticket.createdAt)}
        </p>
        {ticket.evidence && ticket.evidence.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {ticket.evidence.map((ev) => (
              <a
                key={ev.id}
                href={ev.publicPath || ev.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-3 py-1.5 rounded-xl bg-primary/5 text-primary text-xs font-bold hover:bg-primary/10 transition-colors"
              >
                Ver evidencia adjunta
              </a>
            ))}
          </div>
        )}
      </div>
      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
        <Wrench className="w-6 h-6 text-primary" />
      </div>
    </div>
  );
}

export function StaffTicketCard({
  ticket,
  buildingName,
  unitLabel,
  isSubmitting,
  selectedStatus,
  allowedStatuses,
  onStatusChange,
  onSaveStatus,
}: StaffTicketCardProps) {
  const canTransition = ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={incidentStatusChip(ticket.status)}>{labelIncidentStatus(ticket.status)}</span>
          <span className={incidentPriorityChip(ticket.priority)}>{labelIncidentPriority(ticket.priority)}</span>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
            Ubicación
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
            {buildingName}
          </span>
          {unitLabel ? (
            <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
              Unidad {unitLabel}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-sm font-black text-slate-900 truncate">{ticket.title}</p>
        <p className="mt-1 text-xs text-slate-500 font-medium">{ticket.description}</p>
        {ticket.evidence && ticket.evidence.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {ticket.evidence.map((ev) => (
              <a
                key={ev.id}
                href={ev.publicPath || ev.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-3 py-1.5 rounded-xl bg-primary/5 text-primary text-xs font-bold hover:bg-primary/10 transition-colors"
              >
                Ver evidencia adjunta
              </a>
            ))}
          </div>
        )}
        {canTransition ? (
          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
            <select
              value={selectedStatus}
              onChange={(event) => onStatusChange(event.target.value as IncidentEntity['status'])}
              className="w-full sm:w-72 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-xs font-bold"
            >
              <option value="" disabled>
                Marcar como...
              </option>
              {allowedStatuses.map((status) => (
                <option key={status} value={status}>
                  {labelIncidentStatus(status)}
                </option>
              ))}
            </select>
            <button
              disabled={!selectedStatus || isSubmitting}
              onClick={onSaveStatus}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all disabled:opacity-60"
            >
              Guardar
            </button>
          </div>
        ) : null}
      </div>
      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
        <Wrench className="w-6 h-6 text-primary" />
      </div>
    </div>
  );
}

export function TicketComposerDialog({
  isOpen,
  isSubmitting,
  buildings,
  units,
  buildingId,
  unitId,
  title,
  description,
  priority,
  onClose,
  onBuildingChange,
  onUnitChange,
  onTitleChange,
  onDescriptionChange,
  onPriorityChange,
  onSubmit,
}: TicketComposerDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cerrar" className="absolute inset-0 bg-black/30" onClick={onClose} type="button" />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-black text-slate-900">Nueva incidencia</p>
            <p className="mt-1 text-xs text-slate-500 font-medium">Crea una incidencia para el edificio.</p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700">
            Cerrar
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Edificio</label>
            <select
              value={buildingId}
              onChange={(event) => onBuildingChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            >
              <option value="" disabled>
                Selecciona...
              </option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Unidad (opcional)</label>
            <select
              value={unitId}
              onChange={(event) => onUnitChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            >
              <option value="">Sin unidad</option>
              {units
                .filter((unit) => unit.buildingId === buildingId)
                .map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.number}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Prioridad</label>
            <select
              value={priority}
              onChange={(event) => onPriorityChange(event.target.value as IncidentEntity['priority'])}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            >
              <option value="LOW">{labelIncidentPriority('LOW')}</option>
              <option value="MEDIUM">{labelIncidentPriority('MEDIUM')}</option>
              <option value="HIGH">{labelIncidentPriority('HIGH')}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Título</label>
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Descripción</label>
            <textarea
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium min-h-[120px]"
            />
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
            className="px-5 py-3 rounded-xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-70"
          >
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}

export function ResidentTicketComposerDialog({
  isOpen,
  isSubmitting,
  units,
  buildingNameById,
  unitId,
  problemType,
  whereOccurs,
  locationDetail,
  since,
  impact,
  title,
  additionalDetail,
  priority,
  error,
  onClose,
  onUnitChange,
  onProblemTypeChange,
  onWhereOccursChange,
  onLocationDetailChange,
  onSinceChange,
  onImpactChange,
  onTitleChange,
  onAdditionalDetailChange,
  onPriorityChange,
  evidenceFile,
  onEvidenceChange,
  onSubmit,
}: ResidentTicketComposerDialogProps) {
  if (!isOpen) return null;

  const titleLength = title.trim().length;
  const locationDetailLength = locationDetail.trim().length;
  const needsDetail = problemType === 'Otro' || whereOccurs === 'Otro';

  const formatResidentUnitLabel = (unit: TicketUnitOption) => {
    const buildingName = buildingNameById.get(unit.buildingId);
    return buildingName ? `${buildingName} · Depto ${unit.number}` : `Depto ${unit.number}`;
  };
  const selectedUnit = units.find((unit) => unit.id === unitId);
  const reportFromLabel = selectedUnit ? formatResidentUnitLabel(selectedUnit) : '';
  const hasSingleUnit = units.length === 1;
  const hasMultipleUnits = units.length > 1;

  const selectClass =
    'w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium';
  const sectionLabel = 'text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cerrar" className="absolute inset-0 bg-black/30" onClick={onClose} type="button" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-black text-slate-900">Reportar incidencia</p>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Cuéntanos qué ocurre para que el equipo pueda actuar más rápido.
            </p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700">
            Cerrar
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl border border-rose-100">
              {error}
            </div>
          )}

          {/* ── REPORTANTE ────────────────────────────────────── */}
          <div className="space-y-3">
            <p className={sectionLabel}>Reportante</p>

            <div>
              {hasSingleUnit ? (
                <>
                  <p className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                    Reportado desde
                  </p>
                  <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-semibold text-slate-700">
                    {reportFromLabel || formatResidentUnitLabel(units[0])}
                  </div>
                </>
              ) : (
                <>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                    Reportar desde
                  </label>
                  <select
                    value={unitId}
                    onChange={(e) => onUnitChange(e.target.value)}
                    className={selectClass}
                    disabled={!hasMultipleUnits}
                  >
                    <option value="" disabled>Selecciona...</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {formatResidentUnitLabel(unit)}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <p className="mt-2 text-xs text-slate-500 font-medium">
                Usaremos esta unidad para asociar el reporte a tu cuenta. El problema puede ocurrir dentro de tu unidad o en otra zona del edificio.
              </p>
            </div>
          </div>

          {/* ── PROBLEMA ─────────────────────────────────────── */}
          <div className="space-y-3">
            <p className={sectionLabel}>Problema</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                  Tipo de problema
                </label>
                <select value={problemType} onChange={(e) => onProblemTypeChange(e.target.value)} className={selectClass}>
                  <option value="" disabled>Selecciona...</option>
                  <option>Agua / filtración</option>
                  <option>Electricidad</option>
                  <option>Gas</option>
                  <option>Limpieza</option>
                  <option>Seguridad</option>
                  <option>Ruido</option>
                  <option>Ascensor</option>
                  <option>Daño estructural</option>
                  <option>Mantenimiento general</option>
                  <option>Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                  Dónde ocurre
                </label>
                <select value={whereOccurs} onChange={(e) => onWhereOccursChange(e.target.value)} className={selectClass}>
                  <option value="" disabled>Selecciona...</option>
                  <option>Dentro de mi unidad</option>
                  <option>Área común</option>
                  <option>Ascensor</option>
                  <option>Pasillo / hall</option>
                  <option>Escalera</option>
                  <option>Estacionamiento</option>
                  <option>Exterior</option>
                  <option>Todo el edificio</option>
                  <option>Otro</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── CONTEXTO ──────────────────────────────────────── */}
          <div className="space-y-3">
            <p className={sectionLabel}>Contexto</p>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                Lugar específico
              </label>
              <input
                value={locationDetail}
                onChange={(e) => onLocationDetailChange(e.target.value)}
                placeholder="Ej. baño principal, pasillo del piso 3, ascensor de Torre A, zona de parrilla, estacionamiento B12"
                className={selectClass}
              />
              {locationDetailLength > 0 && locationDetailLength < 4 ? (
                <p className="mt-2 text-xs font-bold text-rose-600">Indica el lugar específico del problema.</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                  Desde cuándo ocurre
                </label>
                <select value={since} onChange={(e) => onSinceChange(e.target.value)} className={selectClass}>
                  <option value="" disabled>Selecciona...</option>
                  <option>Ahora / recién ocurrió</option>
                  <option>Hoy</option>
                  <option>Desde ayer</option>
                  <option>Hace varios días</option>
                  <option>No estoy seguro</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                  Afectación
                </label>
                <select value={impact} onChange={(e) => onImpactChange(e.target.value)} className={selectClass}>
                  <option value="" disabled>Selecciona...</option>
                  <option>Solo mi unidad</option>
                  <option>Mi unidad y zonas cercanas</option>
                  <option>Varias unidades</option>
                  <option>Zona común del edificio</option>
                  <option>Todo el edificio</option>
                  <option>No estoy seguro</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Prioridad</label>
              <select
                value={priority}
                onChange={(e) => onPriorityChange(e.target.value as IncidentEntity['priority'])}
                className={selectClass}
              >
                <option value="LOW">{labelIncidentPriority('LOW')}</option>
                <option value="MEDIUM">{labelIncidentPriority('MEDIUM')}</option>
                <option value="HIGH">{labelIncidentPriority('HIGH')}</option>
              </select>
            </div>
          </div>

          {/* ── DETALLE ───────────────────────────────────────── */}
          <div className="space-y-3">
            <p className={sectionLabel}>Detalle</p>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Título</label>
              <input
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Ej. Fuga de agua en baño principal"
                className={selectClass}
              />
              <p className="mt-2 text-xs text-slate-500 font-medium">
                Resume el problema en una frase clara. Mínimo 6 caracteres.
              </p>
              {titleLength > 0 && titleLength < 6 ? (
                <p className="mt-2 text-xs font-bold text-rose-600">El título debe tener al menos 6 caracteres.</p>
              ) : null}
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                Detalle adicional{needsDetail ? '' : ' (opcional)'}
              </label>
              <textarea
                value={additionalDetail}
                onChange={(e) => onAdditionalDetailChange(e.target.value)}
                placeholder={
                  needsDetail
                    ? 'Agrega un detalle adicional cuando selecciones "Otro".'
                    : 'El ascensor se detiene y hay olor a humedad.'
                }
                className={`${selectClass} min-h-[96px]`}
              />
              {needsDetail ? (
                <p className="mt-2 text-xs text-slate-500 font-medium">
                  Explica con más detalle el problema cuando el tipo o la ubicación no encajan en las opciones disponibles.
                </p>
              ) : null}
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                Adjuntar evidencia (opcional)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => onEvidenceChange(e.target.files?.[0] || null)}
                className={selectClass}
              />
              {evidenceFile && (
                <p className="mt-1 ml-1 text-xs font-bold text-primary">Archivo seleccionado: {evidenceFile.name}</p>
              )}
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
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}

export function StaffTicketComposerDialog({
  isOpen,
  isSubmitting,
  units,
  unitId,
  title,
  description,
  priority,
  onClose,
  onUnitChange,
  onTitleChange,
  onDescriptionChange,
  onPriorityChange,
  onSubmit,
}: StaffTicketComposerDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cerrar" className="absolute inset-0 bg-black/30" onClick={onClose} type="button" />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-black text-slate-900">Reportar incidencia</p>
            <p className="mt-1 text-xs text-slate-500 font-medium">Crea una incidencia operativa para tu edificio.</p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700">
            Cerrar
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Unidad (opcional)</label>
            <select
              value={unitId}
              onChange={(event) => onUnitChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            >
              <option value="">Sin unidad</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.number}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Prioridad</label>
            <select
              value={priority}
              onChange={(event) => onPriorityChange(event.target.value as IncidentEntity['priority'])}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            >
              <option value="LOW">{labelIncidentPriority('LOW')}</option>
              <option value="MEDIUM">{labelIncidentPriority('MEDIUM')}</option>
              <option value="HIGH">{labelIncidentPriority('HIGH')}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Título</label>
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Descripción</label>
            <textarea
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium min-h-[120px]"
            />
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
            className="px-5 py-3 rounded-xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-70"
          >
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}
