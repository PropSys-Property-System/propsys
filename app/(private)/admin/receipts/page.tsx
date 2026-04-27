'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Download, Filter, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import { createAdminReceipt, loadAdminReceiptsPageData, updateAdminReceiptStatus } from '@/lib/features/receipts/receipts-center.data';
import { AdminReceiptsList, ReceiptComposerDialog } from '@/lib/features/receipts/receipts-center.ui';
import type { Receipt } from '@/lib/types';

export default function AdminReceiptsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
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
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await loadAdminReceiptsPageData(user);
        if (!isMounted) return;
        setAllReceipts(data.receipts);
        setBuildings(data.buildings);
        setUnits(data.units);
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

  const receipts = useMemo(() => {
    const normalizedTerm = searchTerm.toLowerCase();
    return allReceipts.filter(
      (receipt) =>
        receipt.number.toLowerCase().includes(normalizedTerm) ||
        receipt.description.toLowerCase().includes(normalizedTerm)
    );
  }, [allReceipts, searchTerm]);

  const buildingById = useMemo(() => new Map(buildings.map((building) => [building.id, building])), [buildings]);
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
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
    setCreateDueDate(today);
    setCreateError(null);
    setIsCreateOpen(true);
  }

  function handleCreateBuildingChange(buildingId: string) {
    setCreateBuildingId(buildingId);
    setCreateUnitId(units.find((unit) => unit.buildingId === buildingId)?.id ?? '');
  }

  async function handleCreateReceipt() {
    if (!user) return;

    const amount = Number(createAmount);
    if (!createBuildingId || !createUnitId || !createDescription.trim() || !createIssueDate || !createDueDate || !Number.isFinite(amount) || amount <= 0) {
      setCreateError('Completa edificio, unidad, monto, descripcion y fechas.');
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
      <button disabled className="flex items-center px-4 py-2 bg-slate-100 text-slate-400 rounded-xl font-bold text-sm cursor-not-allowed">
        <Download className="w-4 h-4 mr-2" /> Proximamente
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
      <PageHeader title="Gestion de Recibos" description="Administra, emite y controla los pagos de la comunidad" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Buscar por numero o descripcion..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <button disabled className="flex items-center justify-center px-4 py-3 bg-slate-100 border border-slate-200 text-slate-400 rounded-xl font-bold text-sm cursor-not-allowed">
            <Filter className="w-4 h-4 mr-2" /> Proximamente
          </button>
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

          {error ? (
            <div className="py-12">
              <ErrorState title="Error" description={error} />
            </div>
          ) : isLoading ? (
            <div className="py-12">
              <LoadingState title="Cargando recibos..." />
            </div>
          ) : receipts.length > 0 ? (
            <AdminReceiptsList
              receipts={receipts}
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
                description={searchTerm ? `No hay resultados para "${searchTerm}"` : 'Aun no se han emitido recibos en el sistema.'}
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
        onIssueDateChange={setCreateIssueDate}
        onDueDateChange={setCreateDueDate}
        onSubmit={handleCreateReceipt}
      />
    </div>
  );
}
