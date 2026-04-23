import Link from 'next/link';
import { AlertCircle, ArrowRight, Building2, Calendar, Download, Filter, Receipt } from 'lucide-react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/Receipts';
import { EmptyState } from '@/components/States';
import { formatDateTime } from '@/lib/presentation/dates';
import type { ChecklistExecution, Receipt as ReceiptItem, User } from '@/lib/types';

type DashboardHeaderActionsProps = {
  disabled?: boolean;
};

type DashboardKpiGridProps = {
  buildingsCount: number | null;
  pendingReceiptsCount: number | null;
  requestedReservationsCount: number | null;
  openIncidentsCount: number | null;
};

type DashboardStatsPlaceholderProps = {
  title: string;
  description: string;
};

type DashboardRecentActivityPanelProps = {
  receipts: ReceiptItem[];
};

type DashboardChecklistPanelProps = {
  user: User | null;
  checklistError: string | null;
  checklistsToApprove: ChecklistExecution[];
  templateNameById: Record<string, string>;
  buildingNameById: Record<string, string>;
  isApprovingChecklistId: string | null;
  onApproveChecklist: (checklistExecutionId: string) => void;
};

type DashboardQuickLinksProps = {
  user: User | null;
};

function kpiValue(value: number | null) {
  return value === null ? '-' : String(value);
}

export function DashboardHeaderActions({ disabled = true }: DashboardHeaderActionsProps) {
  return (
    <div className="flex gap-2">
      <button
        disabled={disabled}
        className="flex cursor-not-allowed items-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-400"
      >
        <Download className="mr-2 h-4 w-4" /> Proximamente
      </button>
      <button
        disabled={disabled}
        className="flex cursor-not-allowed items-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-400"
      >
        <Filter className="mr-2 h-4 w-4" /> Proximamente
      </button>
    </div>
  );
}

export function DashboardKpiGrid({
  buildingsCount,
  pendingReceiptsCount,
  requestedReservationsCount,
  openIncidentsCount,
}: DashboardKpiGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="Edificios accesibles"
        value={kpiValue(buildingsCount)}
        icon={Building2}
        variant="primary"
        description="Segun tus asignaciones"
      />
      <KPICard
        title="Recibos pendientes"
        value={kpiValue(pendingReceiptsCount)}
        icon={Receipt}
        variant="amber"
        description="Segun recibos visibles"
      />
      <KPICard
        title="Reservas solicitadas"
        value={kpiValue(requestedReservationsCount)}
        icon={Calendar}
        variant="emerald"
        description="Pendientes de revision"
      />
      <KPICard
        title="Incidencias abiertas"
        value={kpiValue(openIncidentsCount)}
        icon={AlertCircle}
        variant="rose"
        description="Excluye cerradas"
      />
    </div>
  );
}

export function DashboardStatsPlaceholder({ title, description }: DashboardStatsPlaceholderProps) {
  return (
    <div className="flex h-[400px] flex-col rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm lg:col-span-2">
      <div className="space-y-2">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">{title}</h3>
        <p className="text-xs font-medium text-slate-500">{description}</p>
      </div>
      <div className="mt-6 flex flex-1 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-6">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Proximamente</p>
      </div>
    </div>
  );
}

export function DashboardRecentActivityPanel({ receipts }: DashboardRecentActivityPanelProps) {
  return (
    <div className="flex flex-col rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-8 flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Actividad Reciente</h3>
        <Link href="/admin/receipts" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
          Ver Todo
        </Link>
      </div>

      <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto pr-2">
        {receipts.length === 0 ? (
          <div className="py-10">
            <EmptyState title="Sin actividad" description="No hay recibos recientes para mostrar." />
          </div>
        ) : (
          receipts.map((receipt, index) => (
            <div key={receipt.id} className="group flex cursor-pointer items-start space-x-4">
              <div className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${index === 0 ? 'animate-pulse bg-primary' : 'bg-slate-200'}`}></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-700 transition-colors group-hover:text-primary">{receipt.description}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-400">{receipt.number}</span>
                  <StatusBadge status={receipt.status} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <div className="mb-2 flex items-center text-xs font-black uppercase tracking-widest text-slate-400">
          <Calendar className="mr-2 h-3.5 w-3.5 text-primary" /> Agenda
        </div>
        <p className="text-xs font-medium text-slate-600">Proximamente</p>
      </div>
    </div>
  );
}

export function DashboardChecklistPanel({
  user,
  checklistError,
  checklistsToApprove,
  templateNameById,
  buildingNameById,
  isApprovingChecklistId,
  onApproveChecklist,
}: DashboardChecklistPanelProps) {
  if (user?.internalRole !== 'BUILDING_ADMIN') return null;

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex items-center text-xs font-black uppercase tracking-widest text-slate-700">Checklist por aprobar</div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{checklistsToApprove.length}</span>
      </div>
      {checklistError ? (
        <p className="text-xs font-medium text-rose-600">{checklistError}</p>
      ) : checklistsToApprove.length === 0 ? (
        <p className="text-xs font-medium text-slate-600">Sin checklists pendientes.</p>
      ) : (
        <div className="space-y-2">
          {checklistsToApprove.map((execution) => (
            <div key={execution.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-slate-900">{templateNameById[execution.templateId] ?? execution.templateId}</p>
                <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">
                  {buildingNameById[execution.buildingId] ?? execution.buildingId} - {formatDateTime(execution.completedAt ?? execution.updatedAt)}
                </p>
              </div>
              <button
                type="button"
                disabled={isApprovingChecklistId === execution.id}
                onClick={() => onApproveChecklist(execution.id)}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-emerald-700 disabled:opacity-70"
              >
                Aprobar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardQuickLinks({ user }: DashboardQuickLinksProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Link href="/admin/receipts" className="group relative overflow-hidden rounded-[2rem] bg-primary p-6 text-white shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]">
        <div className="absolute -right-8 -bottom-8 opacity-10 transition-transform duration-700 group-hover:scale-125">
          <Receipt className="h-32 w-32" />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <Receipt className="h-5 w-5 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest">Ver recibos</h4>
            <p className="mt-1 text-xs font-medium text-white/80">Revisar y buscar recibos visibles para tu alcance</p>
          </div>
          <div className="flex items-center text-[10px] font-black uppercase tracking-widest">
            Abrir <ArrowRight className="ml-2 h-3 w-3 transition-transform group-hover:translate-x-2" />
          </div>
        </div>
      </Link>

      <Link href="/admin/tickets" className="group rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:bg-slate-50">
        <div className="space-y-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
            <AlertCircle className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Incidencias</h4>
            <p className="mt-1 text-xs font-medium text-slate-400">Ver incidencias operativas visibles para tu alcance</p>
          </div>
          <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-primary">
            Abrir <ArrowRight className="ml-2 h-3 w-3 transition-transform group-hover:translate-x-2" />
          </div>
        </div>
      </Link>

      <Link href="/admin/notices" className="group rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:bg-slate-50">
        <div className="space-y-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <Calendar className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Avisos</h4>
            <p className="mt-1 text-xs font-medium text-slate-400">
              {user?.internalRole === 'BUILDING_ADMIN' ? 'Publicar y revisar avisos de tus edificios' : 'Publicar o revisar avisos segun permisos'}
            </p>
          </div>
          <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-primary">
            Abrir <ArrowRight className="ml-2 h-3 w-3 transition-transform group-hover:translate-x-2" />
          </div>
        </div>
      </Link>
    </div>
  );
}
