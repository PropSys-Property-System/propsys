'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Download, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import {
  createAdminReceipt,
  listAdminReceiptPaymentProofs,
  loadAdminReceiptsPageData,
  reviewReceiptPaymentProof,
  updateAdminReceiptStatus,
} from '@/lib/features/receipts/receipts-center.data';
import { AdminPaymentProofsPanel, AdminReceiptsList, ReceiptComposerDialog } from '@/lib/features/receipts/receipts-center.ui';
import type { Receipt, ReceiptPaymentProofReviewAction, ReceiptPaymentProofView } from '@/lib/types';

function addOneMonthFromDateInput(dateInput: string): string {
  const [year, month, day] = dateInput.split('-').map((value) => Number(value));
  if (!year || !month || !day) return dateInput;
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCMonth(next.getUTCMonth() + 1);
  const outYear = String(next.getUTCFullYear());
  const outMonth = String(next.getUTCMonth() + 1).padStart(2, '0');
  const outDay = String(next.getUTCDate()).padStart(2, '0');
  return `${outYear}-${outMonth}-${outDay}`;
}

export default function AdminReceiptsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'CANCELLED'>('ALL');
  const [buildingFilter, setBuildingFilter] = useState<string>('ALL');
  const [unitSearch, setUnitSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'ISSUE_DESC' | 'ISSUE_ASC' | 'DUE_ASC' | 'DUE_DESC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'>(
    'ISSUE_DESC'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allReceipts, setAllReceipts] = useState<Receipt[]>([]);
  const [buildings, setBuildings] = useState<{ id: string; name: string; clientId?: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; buildingId: string; number: string }[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createBuildingId, setCreateBuildingId] = useState('');
  const [createUnitId, setCreateUnitId] = useState('');
  const [createAmount, setCreateAmount] = useState('');
  const [createCurrency, setCreateCurrency] = useState('PEN');
  const [createDescription, setCreateDescription] = useState('');
  const [createIssueDate, setCreateIssueDate] = useState('');
  const [createDueDate, setCreateDueDate] = useState('');
  const [isCreateDueDateCustomized, setIsCreateDueDateCustomized] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [pendingProofActionId, setPendingProofActionId] = useState<string | null>(null);
  const [pendingProofs, setPendingProofs] = useState<ReceiptPaymentProofView[]>([]);

  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        const [data, proofs] = await Promise.all([
          loadAdminReceiptsPageData(user),
          listAdminReceiptPaymentProofs(user),
        ]);
        if (!isMounted) return;
        setAllReceipts(data.receipts);
        setBuildings(data.buildings);
        setUnits(data.units);
        setPendingProofs(proofs);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar los recibos. Intenta nuevamente.');
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

  const receipts = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    const normalizedUnitSearch = unitSearch.trim().toLowerCase();
    const filtered = allReceipts.filter((receipt) => {
      const unitNumber = unitById.get(receipt.unitId)?.number ?? '';
      const matchesTerm =
        normalizedTerm.length === 0 ||
        receipt.number.toLowerCase().includes(normalizedTerm) ||
        receipt.description.toLowerCase().includes(normalizedTerm);
      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'PENDING'
            ? receipt.status === 'PENDING' || receipt.status === 'OVERDUE'
            : receipt.status === statusFilter;
      const matchesBuilding = buildingFilter === 'ALL' || receipt.buildingId === buildingFilter;
      const matchesUnit =
        normalizedUnitSearch.length === 0 ||
        receipt.unitId.toLowerCase().includes(normalizedUnitSearch) ||
        unitNumber.toLowerCase().includes(normalizedUnitSearch);
      return matchesTerm && matchesStatus && matchesBuilding && matchesUnit;
    });

    return filtered.sort((a, b) => {
      switch (sortOrder) {
        case 'ISSUE_ASC':
          return new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime();
        case 'DUE_ASC':
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'DUE_DESC':
          return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
        case 'AMOUNT_ASC':
          return a.amount - b.amount;
        case 'AMOUNT_DESC':
          return b.amount - a.amount;
        case 'ISSUE_DESC':
        default:
          return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime();
      }
    });
  }, [allReceipts, searchTerm, statusFilter, buildingFilter, unitSearch, sortOrder, unitById]);
  const topPendingReceipts = useMemo(() => {
    const pendingProofReceiptIds = new Set(
      pendingProofs.filter((p) => p.status === 'PENDING_REVIEW').map((p) => p.receiptId)
    );
    return receipts.filter((receipt) => pendingProofReceiptIds.has(receipt.id));
  }, [receipts, pendingProofs]);
  const visibleReceipts = useMemo(
    () => receipts.filter((receipt) => !topPendingReceipts.some((pendingReceipt) => pendingReceipt.id === receipt.id)),
    [receipts, topPendingReceipts]
  );

  const canManageReceipts =
    user?.internalRole === 'ROOT_ADMIN' || user?.internalRole === 'CLIENT_MANAGER' || user?.internalRole === 'BUILDING_ADMIN';

  function openCreateDialog() {
    if (!canManageReceipts) return;

    const firstBuildingId = buildings[0]?.id ?? '';
    const firstUnitId = firstBuildingId ? units.find((unit) => unit.buildingId === firstBuildingId)?.id ?? '' : '';
    const today = new Date().toISOString().slice(0, 10);

    setCreateBuildingId(firstBuildingId);
    setCreateUnitId(firstUnitId);
    setCreateAmount('');
    setCreateCurrency('PEN');
    setCreateDescription('');
    setCreateIssueDate(today);
    setCreateDueDate(addOneMonthFromDateInput(today));
    setIsCreateDueDateCustomized(false);
    setCreateError(null);
    setIsCreateOpen(true);
  }

  function handleCreateBuildingChange(buildingId: string) {
    setCreateBuildingId(buildingId);
    setCreateUnitId(units.find((unit) => unit.buildingId === buildingId)?.id ?? '');
  }

  function handleCreateIssueDateChange(value: string) {
    setCreateIssueDate(value);
    if (!isCreateDueDateCustomized) {
      setCreateDueDate(addOneMonthFromDateInput(value));
    }
  }

  function handleCreateDueDateChange(value: string) {
    setCreateDueDate(value);
    setIsCreateDueDateCustomized(true);
  }

  async function handleCreateReceipt() {
    if (!user) return;

    const amount = Number(createAmount);
    if (!createBuildingId || !createUnitId || !createIssueDate || !createDueDate || !Number.isFinite(amount) || amount <= 0) {
      setCreateError('Completa edificio, unidad, monto y fechas.');
      return;
    }

    try {
      setIsCreateSubmitting(true);
      setCreateError(null);
      setActionError(null);
      setActionMessage(null);
      const created = await createAdminReceipt(user, {
        buildingId: createBuildingId,
        unitId: createUnitId,
        amount,
        currency: createCurrency,
        description: createDescription.trim(),
        issueDate: createIssueDate,
        dueDate: createDueDate,
      });
      setAllReceipts((current) => [created, ...current]);
      setActionMessage(`Recibo ${created.number} emitido correctamente.`);
      setIsCreateOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'No pudimos emitir el recibo.');
    } finally {
      setIsCreateSubmitting(false);
    }
  }

  function openProof(proof: ReceiptPaymentProofView) {
    window.open(proof.fileUrl, '_blank', 'noopener,noreferrer');
  }

  function handleReviewCommentChange(proofId: string, comment: string) {
    setReviewComments((current) => ({ ...current, [proofId]: comment }));
  }

  async function handleReviewProof(proofId: string, action: ReceiptPaymentProofReviewAction) {
    if (!user) return;

    const nextActionId = `${proofId}:${action}`;
    try {
      setPendingProofActionId(nextActionId);
      setActionError(null);
      setActionMessage(null);
      const result = await reviewReceiptPaymentProof(user, {
        proofId,
        action,
        reviewComment: reviewComments[proofId],
      });
      setPendingProofs((current) => current.filter((proof) => proof.id !== proofId));

      setReviewComments((current) => {
        const next = { ...current };
        delete next[proofId];
        return next;
      });
      setAllReceipts((current) =>
        current.map((receipt) => (receipt.id === result.receipt.id ? { ...receipt, status: result.receipt.status } : receipt))
      );
      setActionMessage(action === 'APPROVE' ? 'Comprobante aprobado y recibo marcado como pagado.' : 'Comprobante rechazado y movido a la lista general.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos revisar el comprobante.');
    } finally {
      setPendingProofActionId(null);
    }
  }

  async function handleReceiptStatusChange(receipt: Receipt, status: 'PAID' | 'CANCELLED') {
    if (!user || receipt.status !== 'PENDING') return;

    const actionLabel = status === 'PAID' ? 'marcar como pagado' : 'anular';
    const confirmed = window.confirm(`Quieres ${actionLabel} el recibo ${receipt.number}?`);
    if (!confirmed) return;

    const nextActionId = `${receipt.id}:${status}`;
    try {
      setPendingActionId(nextActionId);
      setActionError(null);
      setActionMessage(null);
      const updated = await updateAdminReceiptStatus(user, { receiptId: receipt.id, status });
      setAllReceipts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setActionMessage(`Recibo ${updated.number} actualizado a ${status === 'PAID' ? 'pagado' : 'cancelado'}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos actualizar el recibo.');
    } finally {
      setPendingActionId(null);
    }
  }

  const actions = (
    <>
      <button
        type="button"
        onClick={() => {
          const header = ['número', 'descripción', 'monto', 'moneda', 'emisión', 'vencimiento', 'estado', 'edificio', 'unidad'];
          const rows = visibleReceipts.map((item) => [
            item.number,
            item.description,
            String(item.amount),
            item.currency,
            item.issueDate,
            item.dueDate,
            item.status,
            item.buildingId,
            item.unitId,
          ]);
          const csv = [header, ...rows].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = 'recibos.csv';
          anchor.click();
          URL.revokeObjectURL(url);
        }}
        disabled={visibleReceipts.length === 0}
        className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <Download className="w-4 h-4 mr-2" /> Exportar CSV
      </button>
      <button
        type="button"
        disabled={!canManageReceipts || buildings.length === 0 || units.length === 0}
        onClick={openCreateDialog}
        className={`flex items-center px-4 py-2 rounded-xl font-bold text-sm transition-all ${
          canManageReceipts && buildings.length > 0 && units.length > 0
            ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        }`}
      >
        <Plus className="w-4 h-4 mr-2" /> Emitir recibo
      </button>
    </>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Gestión de Recibos" description="Administra, emite y controla los pagos de la comunidad" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Buscar por número o descripción..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'ALL' | 'PENDING' | 'PAID' | 'CANCELLED')}
            className="px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm"
          >
            <option value="ALL">Todos los estados</option>
            <option value="PENDING">Pendiente</option>
            <option value="PAID">Pagado</option>
            <option value="CANCELLED">Anulado</option>
          </select>
          <select
            value={buildingFilter}
            onChange={(event) => setBuildingFilter(event.target.value)}
            className="px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm"
          >
            <option value="ALL">Todos los edificios</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={unitSearch}
            onChange={(event) => setUnitSearch(event.target.value)}
            placeholder="Buscar unidad..."
            className="px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium text-sm"
          />
          <select
            value={sortOrder}
            onChange={(event) =>
              setSortOrder(
                event.target.value as 'ISSUE_DESC' | 'ISSUE_ASC' | 'DUE_ASC' | 'DUE_DESC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'
              )
            }
            className="px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm"
          >
            <option value="ISSUE_DESC">Emisión más reciente</option>
            <option value="ISSUE_ASC">Emisión más antigua</option>
            <option value="DUE_ASC">Vence primero</option>
            <option value="DUE_DESC">Vence después</option>
            <option value="AMOUNT_DESC">Monto mayor</option>
            <option value="AMOUNT_ASC">Monto menor</option>
          </select>
        </div>

        <div className="space-y-3">
          {actionMessage ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
              {actionMessage}
            </div>
          ) : null}
          {actionError ? (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {actionError}
            </div>
          ) : null}
          {!error && !isLoading ? (
            <AdminPaymentProofsPanel
              title="Comprobantes pendientes"
              emptyDescription="No hay recibos pendientes por gestionar."
              proofs={pendingProofs.filter((proof) => proof.status === 'PENDING_REVIEW')}
              pendingReceipts={topPendingReceipts}
              pendingActionId={pendingProofActionId}
              reviewComments={reviewComments}
              buildingById={buildingById}
              unitById={unitById}
              onOpenProof={openProof}
              onViewReceipt={(receiptId) => router.push(`/admin/receipts/${receiptId}`)}
              onReviewCommentChange={handleReviewCommentChange}
              onApprove={(proofId) => handleReviewProof(proofId, 'APPROVE')}
              onReject={(proofId) => handleReviewProof(proofId, 'REJECT')}
            />
          ) : null}

          {error ? (
            <div className="py-12">
              <ErrorState title="Error" description={error} />
            </div>
          ) : isLoading ? (
            <div className="py-12">
              <LoadingState title="Cargando recibos..." />
            </div>
          ) : visibleReceipts.length > 0 ? (
            <AdminReceiptsList
              receipts={visibleReceipts}
              buildingById={buildingById}
              unitById={unitById}
              pendingActionId={pendingActionId}
              onView={(receiptId) => router.push(`/admin/receipts/${receiptId}`)}
              onMarkPaid={(receipt) => handleReceiptStatusChange(receipt, 'PAID')}
              onCancelReceipt={(receipt) => handleReceiptStatusChange(receipt, 'CANCELLED')}
            />
          ) : (
            <div className="py-12">
              <EmptyState
                title="No se encontraron recibos"
                description={searchTerm ? `No hay resultados para "${searchTerm}"` : 'Aún no se han emitido recibos en el sistema.'}
              />
            </div>
          )}
        </div>
      </div>
      <ReceiptComposerDialog
        isOpen={isCreateOpen}
        buildings={buildings}
        units={units}
        buildingId={createBuildingId}
        unitId={createUnitId}
        amount={createAmount}
        currency={createCurrency}
        description={createDescription}
        issueDate={createIssueDate}
        dueDate={createDueDate}
        error={createError}
        isSubmitting={isCreateSubmitting}
        onClose={() => setIsCreateOpen(false)}
        onBuildingChange={handleCreateBuildingChange}
        onUnitChange={setCreateUnitId}
        onAmountChange={setCreateAmount}
        onCurrencyChange={setCreateCurrency}
        onDescriptionChange={setCreateDescription}
        onIssueDateChange={handleCreateIssueDateChange}
        onDueDateChange={handleCreateDueDateChange}
        onSubmit={handleCreateReceipt}
      />
    </div>
  );
}
