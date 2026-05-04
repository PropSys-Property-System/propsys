'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { approveAdminDashboardChecklist, loadAdminDashboardData, type AdminDashboardData } from '@/lib/features/dashboard/admin-dashboard.data';
import {
  DashboardChecklistPanel,
  DashboardHeaderActions,
  DashboardKpiGrid,
  DashboardQuickLinks,
  DashboardRecentActivityPanel,
  DashboardStatsPanel,
} from '@/lib/features/dashboard/admin-dashboard.ui';
import { useAuth } from '@/lib/auth/auth-context';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [isApprovingChecklistId, setIsApprovingChecklistId] = useState<string | null>(null);
  const [onlyPendingView, setOnlyPendingView] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        setDashboardData(null);
        const data = await loadAdminDashboardData(user);
        if (!isMounted) return;
        setDashboardData(data);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar el resumen del dashboard.');
        setDashboardData(null);
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

  const hasBuildings = (dashboardData?.buildingsCount ?? 0) > 0;
  const filteredRecentReceipts = (dashboardData?.recentReceipts ?? []).filter((receipt) =>
    onlyPendingView ? receipt.status === 'PENDING' || receipt.status === 'OVERDUE' : true,
  );

  const filteredUpcomingReceipts = (dashboardData?.upcomingDueReceipts ?? []).filter((receipt) =>
    onlyPendingView ? receipt.status === 'PENDING' || receipt.status === 'OVERDUE' : true,
  );

  const approveChecklist = async (id: string) => {
    if (!user) return;

    try {
      setIsApprovingChecklistId(id);
      setError(null);
      const refreshedChecklists = await approveAdminDashboardChecklist(user, id);
      setDashboardData((current) =>
        current
          ? {
              ...current,
              checklistError: null,
              checklistsToApprove: refreshedChecklists,
            }
          : current,
      );
    } catch {
      setError('No pudimos aprobar el checklist.');
    } finally {
      setIsApprovingChecklistId(null);
    }
  };

  const exportSnapshot = () => {
    if (!dashboardData) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      buildingsCount: dashboardData.buildingsCount,
      pendingReceiptsCount: dashboardData.pendingReceiptsCount,
      requestedReservationsCount: dashboardData.requestedReservationsCount,
      openIncidentsCount: dashboardData.openIncidentsCount,
      receiptStatusCounts: dashboardData.receiptStatusCounts,
      recentReceipts: filteredRecentReceipts,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    link.download = `dashboard-resumen-${stamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col bg-slate-50/50">
      <PageHeader
        title="Dashboard Administrativo"
        description={`Bienvenido de nuevo, ${user?.name}. Aqui tienes un resumen de tu alcance en PropSys.`}
        actions={
          <DashboardHeaderActions
            disabled={isLoading || !dashboardData}
            isPendingOnly={onlyPendingView}
            onExport={exportSnapshot}
            onTogglePending={() => setOnlyPendingView((current) => !current)}
          />
        }
      />

      <div className="mx-auto w-full max-w-7xl space-y-8 p-6 md:p-8">
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
            <DashboardKpiGrid
              buildingsCount={dashboardData?.buildingsCount ?? null}
              pendingReceiptsCount={dashboardData?.pendingReceiptsCount ?? null}
              requestedReservationsCount={dashboardData?.requestedReservationsCount ?? null}
              openIncidentsCount={dashboardData?.openIncidentsCount ?? null}
            />
            {onlyPendingView ? (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                Vista filtrada: mostrando solo recibos en estado pendiente o vencido.
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <DashboardStatsPanel receiptStatusCounts={dashboardData?.receiptStatusCounts ?? { pending: 0, overdue: 0, paid: 0, cancelled: 0 }} />

              <div>
                <DashboardRecentActivityPanel
                  receipts={filteredRecentReceipts}
                  upcomingDueReceipts={filteredUpcomingReceipts}
                  isPendingOnly={onlyPendingView}
                />
                <DashboardChecklistPanel
                  user={user}
                  checklistError={dashboardData?.checklistError ?? null}
                  checklistsToApprove={dashboardData?.checklistsToApprove ?? []}
                  templateNameById={dashboardData?.templateNameById ?? {}}
                  buildingNameById={dashboardData?.buildingNameById ?? {}}
                  isApprovingChecklistId={isApprovingChecklistId}
                  onApproveChecklist={approveChecklist}
                />
              </div>
            </div>

            <DashboardQuickLinks user={user} />
          </>
        )}
      </div>

      <div className="py-8 text-center">
        <span className="text-xs font-black uppercase tracking-[0.5em] text-slate-300">PropSys Dashboard</span>
      </div>
    </div>
  );
}
