'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Search, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { listReceiptPaymentProofsForReceipt, loadResidentReceiptsPageData } from '@/lib/features/receipts/receipts-center.data';
import { ResidentReceiptsList, ResidentReceiptsOverview } from '@/lib/features/receipts/receipts-center.ui';
import { Receipt, ReceiptPaymentProofView } from '@/lib/types';
import { formatReceiptAmount, summarizeReceiptTotalsByCurrency } from '@/lib/presentation/receipts';

export default function ResidentReceiptsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [buildings, setBuildings] = useState<{ id: string; name: string; clientId?: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; buildingId: string; number: string }[]>([]);
  const [proofsByReceiptId, setProofsByReceiptId] = useState<Record<string, ReceiptPaymentProofView[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setLoadError(null);
        const data = await loadResidentReceiptsPageData(user);
        const proofEntries = await Promise.all(
          data.receipts.map(async (receipt) => {
            const proofs = await listReceiptPaymentProofsForReceipt(user, receipt.id).catch(() => []);
            return [receipt.id, proofs] as const;
          })
        );
        if (!isMounted) return;
        setReceipts(data.receipts);
        setBuildings(data.buildings);
        setUnits(data.units);
        setProofsByReceiptId(Object.fromEntries(proofEntries));
      } catch {
        if (!isMounted) return;
        setLoadError('No pudimos cargar tus recibos.');
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

  const filteredReceipts = useMemo(
    () =>
      receipts.filter((receipt) =>
        receipt.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.description.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [receipts, searchTerm]
  );

  const pendingAmount = useMemo(
    () =>
      receipts
        .filter((receipt) => receipt.status === 'PENDING' || receipt.status === 'OVERDUE')
        .map(({ amount, currency }) => ({ amount, currency })),
    [receipts]
  );

  const pendingAmountLabel = useMemo(() => {
    const totals = summarizeReceiptTotalsByCurrency(pendingAmount);
    if (totals.length === 0) return formatReceiptAmount(0, 'PEN');
    return totals.join(' · ');
  }, [pendingAmount]);

  const latestPaidReceipt = useMemo(
    () =>
      [...receipts]
        .filter((receipt) => receipt.status === 'PAID')
        .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())[0] ?? null,
    [receipts]
  );

  const buildingById = useMemo(() => new Map(buildings.map((building) => [building.id, building])), [buildings]);
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader 
        title="Mis Recibos" 
        description="Gestiona tus gastos comunes y comprobantes de pago de PropSys"
      />
      
      <div className="p-6 md:p-8 space-y-8">
        <ResidentReceiptsOverview
          pendingAmountLabel={pendingAmountLabel}
          latestPaidAmountLabel={latestPaidReceipt ? formatReceiptAmount(latestPaidReceipt.amount, latestPaidReceipt.currency) : formatReceiptAmount(0, 'PEN')}
        />
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-slate-100 pb-6">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mr-auto">Historial Reciente</h3>
          <div className="relative group w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar por recibo..." 
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-primary hover:border-primary/20 transition-all">
            <Filter className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {loadError ? (
            <ErrorState title="Error" description={loadError} />
          ) : isLoading ? (
            <LoadingState title="Cargando recibos..." />
          ) : filteredReceipts.length > 0 ? (
            <ResidentReceiptsList
              receipts={filteredReceipts}
              proofsByReceiptId={proofsByReceiptId}
              buildingById={buildingById}
              unitById={unitById}
              onView={(receiptId) => router.push(`/resident/receipts/${receiptId}`)}
            />
          ) : (
            <div className="py-12 bg-white rounded-3xl border border-dashed border-slate-200">
              <EmptyState 
                title="No tienes recibos" 
                description={searchTerm ? `No hay resultados para "${searchTerm}"` : "Aún no se han emitido recibos para tu unidad."}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

