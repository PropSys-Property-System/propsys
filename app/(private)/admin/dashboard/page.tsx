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
  DashboardStatsPlaceholder,
} from '@/lib/features/dashboard/admin-dashboard.ui';
import { useAuth } from '@/lib/auth/auth-context';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [isApprovingChecklistId, setIsApprovingChecklistId] = useState<string | null>(null);

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

  return (
    <div className="flex h-full flex-col bg-slate-50/50">
      <PageHeader
        title="Dashboard Administrativo"
        description={`Bienvenido de nuevo, ${user?.name}. Aqui tienes un resumen de tu alcance en PropSys.`}
        actions={<DashboardHeaderActions />}
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

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <DashboardStatsPlaceholder
                title="Estadisticas"
                description="Los graficos historicos se habilitaran cuando exista backend persistente. Este resumen muestra solo datos disponibles para tu alcance."
              />

              <div>
                <DashboardRecentActivityPanel receipts={dashboardData?.recentReceipts ?? []} />
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
