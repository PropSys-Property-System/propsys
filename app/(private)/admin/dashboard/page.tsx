'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/lib/auth/auth-context';
import { KPICard } from '@/components/KPICard';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { 
  Receipt, 
  Building2, 
  AlertCircle, 
  Calendar,
  ArrowRight,
  Download,
  Filter
} from 'lucide-react';
import Link from 'next/link';
import { StatusBadge } from '@/components/Receipts';
import { buildingsRepo, checklistExecutionsRepo, checklistTemplatesRepo, incidentsRepo, receiptsRepo, reservationsRepo } from '@/lib/data';
import { formatDateTime } from '@/lib/presentation/dates';
import type { ChecklistExecution, ChecklistTemplate, Receipt as ReceiptType } from '@/lib/types';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buildingsCount, setBuildingsCount] = useState<number | null>(null);
  const [pendingReceiptsCount, setPendingReceiptsCount] = useState<number | null>(null);
  const [openIncidentsCount, setOpenIncidentsCount] = useState<number | null>(null);
  const [requestedReservationsCount, setRequestedReservationsCount] = useState<number | null>(null);
  const [recentReceipts, setRecentReceipts] = useState<ReceiptType[]>([]);
  const [checklistsToApprove, setChecklistsToApprove] = useState<ChecklistExecution[]>([]);
  const [templateNameById, setTemplateNameById] = useState<Record<string, string>>({});
  const [buildingNameById, setBuildingNameById] = useState<Record<string, string>>({});
  const [isApprovingChecklistId, setIsApprovingChecklistId] = useState<string | null>(null);
  const [checklistError, setChecklistError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setError(null);

        const [buildings, receipts, incidents, reservations] = await Promise.all([
          buildingsRepo.listForUser(user),
          receiptsRepo.listForUser(user),
          incidentsRepo.listForUser(user),
          reservationsRepo.listForUser(user),
        ]);

        const sortedReceipts = [...receipts].sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());

        if (!isMounted) return;
        setBuildingsCount(buildings.length);
        setBuildingNameById(Object.fromEntries(buildings.map((b) => [b.id, b.name])));
        setPendingReceiptsCount(receipts.filter((r) => r.status === 'PENDING').length);
        setOpenIncidentsCount(incidents.filter((i) => i.status !== 'CLOSED').length);
        setRequestedReservationsCount(reservations.filter((r) => r.status === 'REQUESTED').length);
        setRecentReceipts(sortedReceipts.slice(0, 5));

        if (user.internalRole === 'BUILDING_ADMIN') {
          try {
            const [executions, templates] = await Promise.all([
              checklistExecutionsRepo.listForUser(user),
              checklistTemplatesRepo.listForUser(user),
            ]);
            if (!isMounted) return;
            setChecklistError(null);
            setTemplateNameById(Object.fromEntries(templates.map((t: ChecklistTemplate) => [t.id, t.name])));
            setChecklistsToApprove(executions.filter((e) => e.status === 'COMPLETED').slice(0, 8));
          } catch {
            if (!isMounted) return;
            setChecklistError('No pudimos cargar los checklists por aprobar.');
            setTemplateNameById({});
            setChecklistsToApprove([]);
          }
        } else {
          setChecklistError(null);
          setChecklistsToApprove([]);
          setTemplateNameById({});
        }
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar el resumen del dashboard.');
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

  const hasBuildings = (buildingsCount ?? 0) > 0;

  const kpiValue = (v: number | null) => (v === null ? '-' : String(v));

  const approveChecklist = async (id: string) => {
    if (!user) return;
    try {
      setIsApprovingChecklistId(id);
      setError(null);
      await checklistExecutionsRepo.approveForUser(user, id);
      const refreshed = await checklistExecutionsRepo.listForUser(user);
      setChecklistsToApprove(refreshed.filter((e) => e.status === 'COMPLETED').slice(0, 8));
    } catch {
      setError('No pudimos aprobar el checklist.');
    } finally {
      setIsApprovingChecklistId(null);
    }
  };

  const actions = (
    <div className="flex gap-2">
      <button disabled className="flex items-center px-4 py-2 bg-slate-100 text-slate-400 rounded-xl font-bold text-sm cursor-not-allowed">
        <Download className="w-4 h-4 mr-2" /> Próximamente
      </button>
      <button disabled className="flex items-center px-4 py-2 bg-slate-100 text-slate-400 rounded-xl font-bold text-sm cursor-not-allowed">
        <Filter className="w-4 h-4 mr-2" /> Próximamente
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader 
        title="Dashboard Administrativo" 
        description={`Bienvenido de nuevo, ${user?.name}. Aquí tienes un resumen de tu alcance en PropSys.`}
        actions={actions}
      />

      <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando dashboard..." />
        ) : !hasBuildings ? (
          <EmptyState
            title="Sin edificios asignados"
            description="No hay edificios disponibles para tu perfil, por lo que no se puede mostrar un resumen operativo."
          />
        ) : (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPICard
                title="Edificios accesibles"
                value={kpiValue(buildingsCount)}
                icon={Building2}
                variant="primary"
                description="Según tus asignaciones"
              />
              <KPICard
                title="Recibos pendientes"
                value={kpiValue(pendingReceiptsCount)}
                icon={Receipt}
                variant="amber"
                description="Según recibos visibles"
              />
              <KPICard
                title="Reservas solicitadas"
                value={kpiValue(requestedReservationsCount)}
                icon={Calendar}
                variant="emerald"
                description="Pendientes de revisión"
              />
              <KPICard
                title="Incidencias abiertas"
                value={kpiValue(openIncidentsCount)}
                icon={AlertCircle}
                variant="rose"
                description="Excluye cerradas"
              />
            </div>

        {/* Middle Section: Charts & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-[400px]">
            <div className="space-y-2">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Estadísticas</h3>
              <p className="text-xs text-slate-500 font-medium">
                Los gráficos históricos se habilitarán cuando exista backend persistente. Este resumen muestra solo datos disponibles para tu alcance.
              </p>
            </div>
            <div className="flex-1 mt-6 p-6 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Próximamente</p>
            </div>
          </div>

          {/* Activity Sidebar */}
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Actividad Reciente</h3>
              <Link href="/admin/receipts" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Ver Todo</Link>
            </div>
            
            <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {recentReceipts.length === 0 ? (
                <div className="py-10">
                  <EmptyState title="Sin actividad" description="No hay recibos recientes para mostrar." />
                </div>
              ) : recentReceipts.map((r, i) => (
                <div key={r.id} className="flex items-start space-x-4 group cursor-pointer">
                  <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${i === 0 ? 'bg-primary animate-pulse' : 'bg-slate-200'}`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate group-hover:text-primary transition-colors">{r.description}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] font-medium text-slate-400">{r.number}</span>
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                <Calendar className="w-3.5 h-3.5 mr-2 text-primary" /> Agenda
              </div>
              <p className="text-xs text-slate-600 font-medium">Próximamente</p>
            </div>

            {user?.internalRole === 'BUILDING_ADMIN' && (
              <div className="mt-6 p-4 bg-white rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center text-xs font-black text-slate-700 uppercase tracking-widest">
                    Checklist por aprobar
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{checklistsToApprove.length}</span>
                </div>
                {checklistError ? (
                  <p className="text-xs text-rose-600 font-medium">{checklistError}</p>
                ) : checklistsToApprove.length === 0 ? (
                  <p className="text-xs text-slate-600 font-medium">Sin checklists pendientes.</p>
                ) : (
                  <div className="space-y-2">
                    {checklistsToApprove.map((e) => (
                      <div key={e.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 truncate">{templateNameById[e.templateId] ?? e.templateId}</p>
                          <p className="mt-1 text-[10px] text-slate-500 font-semibold truncate">
                            {buildingNameById[e.buildingId] ?? e.buildingId} · {formatDateTime(e.completedAt ?? e.updatedAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isApprovingChecklistId === e.id}
                          onClick={() => approveChecklist(e.id)}
                          className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-70"
                        >
                          Aprobar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section: Quick Links or Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/admin/receipts" className="p-6 bg-primary text-white rounded-[2rem] shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all group overflow-hidden relative">
            <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-125 transition-transform duration-700">
              <Receipt className="w-32 h-32" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest">Ver recibos</h4>
                <p className="text-xs text-white/80 font-medium mt-1">Revisar y buscar recibos visibles para tu alcance</p>
              </div>
              <div className="flex items-center text-[10px] font-black uppercase tracking-widest">
                Abrir <ArrowRight className="w-3 h-3 ml-2 group-hover:translate-x-2 transition-transform" />
              </div>
            </div>
          </Link>

          <Link href="/admin/tickets" className="p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm hover:bg-slate-50 transition-all group">
            <div className="space-y-4">
              <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Incidencias</h4>
                <p className="text-xs text-slate-400 font-medium mt-1">Ver incidencias operativas visibles para tu alcance</p>
              </div>
              <div className="flex items-center text-[10px] font-black text-primary uppercase tracking-widest">
                Abrir <ArrowRight className="w-3 h-3 ml-2 group-hover:translate-x-2 transition-transform" />
              </div>
            </div>
          </Link>

          <Link href="/admin/notices" className="p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm hover:bg-slate-50 transition-all group">
            <div className="space-y-4">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Avisos</h4>
                <p className="text-xs text-slate-400 font-medium mt-1">Publicar o revisar avisos según permisos</p>
              </div>
              <div className="flex items-center text-[10px] font-black text-primary uppercase tracking-widest">
                Abrir <ArrowRight className="w-3 h-3 ml-2 group-hover:translate-x-2 transition-transform" />
              </div>
            </div>
          </Link>
        </div>
          </>
        )}
      </div>
      
      {/* Branding PropSys */}
      <div className="py-8 text-center">
        <span className="text-xs font-black text-slate-300 uppercase tracking-[0.5em]">PropSys Dashboard</span>
      </div>
    </div>
  );
}

