'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import { loadResidentReceiptDetailData, reportResidentReceiptPayment } from '@/lib/features/receipts/receipts-center.data';
import { ResidentReceiptDetailView, ResidentReceiptHeaderActions } from '@/lib/features/receipts/receipts-center.ui';
import type { Building as BuildingType, Receipt, Unit as UnitType } from '@/lib/types';

interface PageParams {
  id: string;
}

export default function ResidentReceiptDetailPage({ params }: { params: Promise<PageParams> }) {
  const router = useRouter();
  const { user } = useAuth();
  const resolvedParams = use(params);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [building, setBuilding] = useState<BuildingType | null>(null);
  const [unit, setUnit] = useState<UnitType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setLoadError(null);
        const data = await loadResidentReceiptDetailData(user, resolvedParams.id);
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
              onClick={() => router.push('/resident/receipts')}
              className="flex items-center bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              Volver a mis recibos
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
          description="No pudimos encontrar el recibo solicitado."
          action={
            <button
              onClick={() => router.push('/resident/receipts')}
              className="flex items-center bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              Volver a mis recibos
            </button>
          }
        />
      </div>
    );
  }

  function downloadReceipt(target: Receipt) {
    const lines = [
      `Recibo: ${target.number}`,
      `Descripcion: ${target.description}`,
      `Monto: ${target.amount} ${target.currency}`,
      `Emision: ${target.issueDate}`,
      `Vencimiento: ${target.dueDate}`,
      `Estado: ${target.status}`,
      `Edificio: ${building?.name ?? target.buildingId}`,
      `Unidad: ${unit?.number ?? target.unitId}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${target.number}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handlePay(target: Receipt) {
    if (!user) return;
    const confirmed = window.confirm(`Confirmas el pago del recibo ${target.number}?`);
    if (!confirmed) return;
    try {
      setIsPaying(true);
      setActionError(null);
      setActionMessage(null);
      const updated = await reportResidentReceiptPayment(user, target.id);
      setReceipt(updated);
      setActionMessage(`Pago registrado para ${updated.number}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos registrar el pago.');
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <>
      {actionError ? (
        <div className="bg-rose-50 border-b border-rose-100 px-6 py-3 text-sm font-bold text-rose-700">{actionError}</div>
      ) : null}
      {actionMessage ? (
        <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-3 text-sm font-bold text-emerald-700">{actionMessage}</div>
      ) : null}
      <ResidentReceiptDetailView
        receipt={receipt}
        building={building}
        unit={unit}
        actions={
          <ResidentReceiptHeaderActions
            receipt={receipt}
            receiptStatus={receipt.status}
            onDownload={downloadReceipt}
            onPay={handlePay}
            isPaying={isPaying}
          />
        }
      />
    </>
  );
}
