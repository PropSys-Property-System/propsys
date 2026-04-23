'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import { loadAdminReceiptDetailData } from '@/lib/features/receipts/receipts-center.data';
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

  return <AdminReceiptDetailView receipt={receipt} building={building} unit={unit} actions={<AdminReceiptHeaderActions />} />;
}
