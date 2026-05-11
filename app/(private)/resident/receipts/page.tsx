'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  buildResidentUnitFilterOptions,
  filterAndSortResidentReceipts,
  listReceiptPaymentProofsForReceipt,
  loadResidentReceiptsPageData,
  type ResidentReceiptsSortOrder,
  type ResidentReceiptsStatusFilter,
} from '@/lib/features/receipts/receipts-center.data';
import { ResidentReceiptsList, ResidentReceiptsOverview } from '@/lib/features/receipts/receipts-center.ui';
import { Receipt, ReceiptPaymentProofView } from '@/lib/types';
import { formatReceiptAmount, summarizeReceiptTotalsByCurrency } from '@/lib/presentation/receipts';

export default function ResidentReceiptsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ResidentReceiptsStatusFilter>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<ResidentReceiptsSortOrder>('DUE_ASC');
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

  const buildingById = useMemo(() => new Map(buildings.map((building) => [building.id, building])), [buildings]);
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const residentUnitOptions = useMemo(() => buildResidentUnitFilterOptions(units, buildings), [units, buildings]);
  const unitLabelById = useMemo(() => new Map(residentUnitOptions.map((option) => [option.id, option.label])), [residentUnitOptions]);
  const filteredReceipts = useMemo(
    () => filterAndSortResidentReceipts(receipts, searchTerm, statusFilter, unitFilter, sortOrder),
    [receipts, searchTerm, statusFilter, unitFilter, sortOrder]
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
        <div className="space-y-3 border-b border-slate-100 pb-6">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Historial Reciente</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Buscar por recibo..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ResidentReceiptsStatusFilter)}
              className="px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm"
            >
              <option value="ALL">Todos los estados</option>
              <option value="PENDING">Pendiente</option>
              <option value="PAID">Pagado</option>
              <option value="CANCELLED">Anulado</option>
            </select>
            <select
              value={unitFilter}
              onChange={(event) => setUnitFilter(event.target.value)}
              className="px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm"
            >
              <option value="ALL">Todas las unidades</option>
              {residentUnitOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as ResidentReceiptsSortOrder)}
              className="px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm"
            >
              <option value="DUE_ASC">Vence primero</option>
              <option value="DUE_DESC">Vence despues</option>
              <option value="ISSUE_DESC">Emision mas reciente</option>
              <option value="ISSUE_ASC">Emision mas antigua</option>
              <option value="AMOUNT_DESC">Monto mayor</option>
              <option value="AMOUNT_ASC">Monto menor</option>
            </select>
          </div>
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
                description={
                  searchTerm
                    ? `No hay resultados para "${searchTerm}"`
                    : unitFilter !== 'ALL'
                      ? `No hay recibos para ${unitLabelById.get(unitFilter) ?? 'la unidad seleccionada'}.`
                      : "Aún no se han emitido recibos para tu unidad."
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


