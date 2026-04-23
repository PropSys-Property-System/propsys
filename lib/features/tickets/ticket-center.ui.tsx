import { Wrench } from 'lucide-react';
import { formatDateTime } from '@/lib/presentation/dates';
import { labelClient, labelIncidentPriority, labelIncidentStatus } from '@/lib/presentation/labels';
import type { IncidentEntity } from '@/lib/types';
import type { TicketBuildingOption, TicketUnitOption } from '@/lib/features/tickets/ticket-center.data';

type AdminTicketCardProps = {
  ticket: IncidentEntity;
  buildingName: string;
  unitLabel?: string | null;
  canUpdate: boolean;
  isSubmitting: boolean;
  selectedStatus: IncidentEntity['status'] | '';
  allStatuses: IncidentEntity['status'][];
  onStatusChange: (status: IncidentEntity['status']) => void;
  onSaveStatus: () => void;
  onCloseIncident: () => void;
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
  ticket: IncidentEntity;
};

type ResidentTicketComposerDialogProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  units: TicketUnitOption[];
  buildingNameById: ReadonlyMap<string, string>;
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

type StaffTicketCardProps = {
  ticket: IncidentEntity;
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
  onStatusChange,
  onSaveStatus,
  onCloseIncident,
}: AdminTicketCardProps) {
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

        {canUpdate && (
          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
            <select
              value={selectedStatus}
              onChange={(event) => onStatusChange(event.target.value as IncidentEntity['status'])}
              className="w-full sm:w-56 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-xs font-bold"
            >
              <option value="" disabled>
                Cambiar estado...
              </option>
              {allStatuses.map((status) => (
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
              Cerrar
            </button>
          </div>
        )}
      </div>
      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
        <Wrench className="w-6 h-6 text-primary" />
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
      </div>
      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
        <Wrench className="w-6 h-6 text-primary" />
      </div>
    </div>
  );
}

export function StaffTicketCard({
  ticket,
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
        <p className="mt-3 text-sm font-black text-slate-900 truncate">{ticket.title}</p>
        <p className="mt-1 text-xs text-slate-500 font-medium">{ticket.description}</p>
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
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Titulo</label>
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Descripcion</label>
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
  title,
  description,
  priority,
  onClose,
  onUnitChange,
  onTitleChange,
  onDescriptionChange,
  onPriorityChange,
  onSubmit,
}: ResidentTicketComposerDialogProps) {
  if (!isOpen) return null;

  const selectedUnit = units.find((unit) => unit.id === unitId);
  const selectedBuildingName = selectedUnit ? buildingNameById.get(selectedUnit.buildingId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cerrar" className="absolute inset-0 bg-black/30" onClick={onClose} type="button" />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-black text-slate-900">Reportar incidencia</p>
            <p className="mt-1 text-xs text-slate-500 font-medium">Crea una incidencia para una de tus unidades.</p>
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
                  {unit.number}
                </option>
              ))}
            </select>
            {selectedBuildingName ? (
              <p className="mt-2 text-xs text-slate-500 font-bold">
                Edificio: <span className="font-black text-slate-700">{selectedBuildingName}</span>
              </p>
            ) : null}
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
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Titulo</label>
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Descripcion</label>
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
