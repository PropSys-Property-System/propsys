'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import { loadAdminReceiptDetailData, updateAdminReceiptStatus } from '@/lib/features/receipts/receipts-center.data';
import { AdminReceiptDetailView, AdminReceiptHeaderActions } from '@/lib/features/receipts/receipts-center.ui';
import type { Building as BuildingType, Receipt, Unit as UnitType } from '@/lib/types';

export default function AdminReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user } = useAuth();
  const resolvedParams = use(params);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [building, setBuilding] = useState<BuildingType | null>(null);
  const [unit, setUnit] = useState<UnitType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setLoadError(null);
        const data = await loadAdminReceiptDetailData(user, resolvedParams.id);
        if (!isMounted) return;
        setReceipt(data.receipt);
        setBuilding(data.building);
        setUnit(data.unit);
      } catch {
        if (!isMounted) return;
        setLoadError('No pudimos cargar el recibo.');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [resolvedParams.id, user]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <LoadingState title="Cargando recibo..." />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <ErrorState
          title="Error"
          description={loadError}
          action={
            <button
              onClick={() => router.push('/admin/receipts')}
              className="flex items-center bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              Volver a la lista
            </button>
          }
        />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <ErrorState
          title="Recibo no encontrado"
          description="El identificador del recibo no existe o ha sido eliminado."
          action={
            <button
              onClick={() => router.push('/admin/receipts')}
              className="flex items-center bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              Volver a la lista
            </button>
          }
        />
      </div>
    );
  }

  async function handleReceiptStatusChange(target: Receipt, status: 'PAID' | 'CANCELLED') {
    if (!user || target.status !== 'PENDING') return;

    const actionLabel = status === 'PAID' ? 'marcar como pagado' : 'anular';
    const confirmed = window.confirm(`Quieres ${actionLabel} el recibo ${target.number}?`);
    if (!confirmed) return;

    const nextActionId = `${target.id}:${status}`;
    try {
      setPendingActionId(nextActionId);
      setActionError(null);
      const updated = await updateAdminReceiptStatus(user, { receiptId: target.id, status });
      setReceipt(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos actualizar el recibo.');
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <>
      {actionError ? (
        <div className="bg-rose-50 border-b border-rose-100 px-6 py-3 text-sm font-bold text-rose-700">
          {actionError}
        </div>
      ) : null}
      <AdminReceiptDetailView
        receipt={receipt}
        building={building}
        unit={unit}
        actions={
          <AdminReceiptHeaderActions
            receipt={receipt}
            pendingActionId={pendingActionId}
            onMarkPaid={(item) => handleReceiptStatusChange(item, 'PAID')}
            onCancelReceipt={(item) => handleReceiptStatusChange(item, 'CANCELLED')}
          />
        }
      />
    </>
  );
}
