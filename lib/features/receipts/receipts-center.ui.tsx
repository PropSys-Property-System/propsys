import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building as BuildingIcon,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit2,
  ExternalLink,
  FileText,
  Home,
  Printer,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { ReceiptRow, StatusBadge } from '@/components/Receipts';
import { CardListSkeleton, SkeletonBlock, SkeletonStatus } from '@/components/States';
import { formatReceiptAmount, formatReceiptDate } from '@/lib/presentation/receipts';
import { labelClient, labelReceiptStatus } from '@/lib/presentation/labels';
import type { Building, Receipt, ReceiptPaymentProofView, Unit } from '@/lib/types';

type ReceiptBuildingLookup = {
  id: string;
  name: string;
  clientId?: string;
};

type ReceiptUnitLookup = {
  id: string;
  buildingId: string;
  number: string;
};

type AdminReceiptsListProps = {
  receipts: Receipt[];
  buildingById: Map<string, ReceiptBuildingLookup>;
  unitById: Map<string, ReceiptUnitLookup>;
  pendingActionId?: string | null;
  onView: (receiptId: string) => void;
  onMarkPaid?: (receipt: Receipt) => void | Promise<void>;
  onCancelReceipt?: (receipt: Receipt) => void | Promise<void>;
};

type AdminReceiptDetailViewProps = {
  receipt: Receipt;
  building: Building | null;
  unit: Unit | null;
  actions: ReactNode;
  paymentProofPanel?: ReactNode;
  onDelete?: (receipt: Receipt) => void | Promise<void>;
  isDeleting?: boolean;
};

type ResidentReceiptsOverviewProps = {
  pendingAmountLabel: string;
  latestPaidAmountLabel: string;
};

type ResidentReceiptsListProps = {
  receipts: Receipt[];
  proofsByReceiptId?: Record<string, ReceiptPaymentProofView[]>;
  buildingById?: Map<string, ReceiptBuildingLookup>;
  unitById?: Map<string, ReceiptUnitLookup>;
  onView: (receiptId: string) => void;
};

type ReceiptComposerDialogProps = {
  isOpen: boolean;
  buildings: ReceiptBuildingLookup[];
  units: ReceiptUnitLookup[];
  buildingId: string;
  unitId: string;
  amount: string;
  currency: string;
  description: string;
  issueDate: string;
  dueDate: string;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onBuildingChange: (buildingId: string) => void;
  onUnitChange: (unitId: string) => void;
  onAmountChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onIssueDateChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
};

type AdminReceiptHeaderActionsProps = {
  receipt: Receipt;
  pendingActionId?: string | null;
  onMarkPaid?: (receipt: Receipt) => void | Promise<void>;
  onCancelReceipt?: (receipt: Receipt) => void | Promise<void>;
  onEdit?: (receipt: Receipt) => void;
  editDisabledReason?: string | null;
  onPrint?: (receipt: Receipt) => void;
};

type ResidentReceiptHeaderActionsProps = {
  receipt: Receipt;
  receiptStatus: Receipt['status'];
  onPrint?: (receipt: Receipt) => void;
  onPay?: (receipt: Receipt) => void | Promise<void>;
  isPaying?: boolean;
};

type ResidentReceiptDetailViewProps = {
  receipt: Receipt;
  building: Building | null;
  unit: Unit | null;
  actions: ReactNode;
  paymentProofPanel?: ReactNode;
};

type ResidentPaymentProofPanelProps = {
  receipt: Receipt;
  proofs: ReceiptPaymentProofView[];
  selectedFile: File | null;
  note: string;
  isSubmitting: boolean;
  error?: string | null;
  message?: string | null;
  onFileChange: (file: File | null) => void;
  onNoteChange: (note: string) => void;
  onUpload: () => void | Promise<void>;
  onOpenProof?: (proof: ReceiptPaymentProofView) => void;
};

function ReceiptOverviewSkeletonBlocks() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="space-y-3">
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className="h-10 w-36" />
          </div>
          <SkeletonBlock className="h-14 w-14 rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

export function ResidentReceiptsSkeleton() {
  return (
    <SkeletonStatus label="Cargando recibos..." className="space-y-8">
      <ReceiptOverviewSkeletonBlocks />
      <div className="space-y-3 border-b border-slate-100 pb-6">
        <SkeletonBlock className="h-4 w-36" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonBlock key={index} className="h-12 w-full bg-white" />
          ))}
        </div>
      </div>
      <CardListSkeleton count={3} label={null} />
    </SkeletonStatus>
  );
}

export function AdminReceiptsWorkspaceSkeleton() {
  return (
    <SkeletonStatus label="Cargando recibos..." className="space-y-4">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <SkeletonBlock className="h-5 w-52" />
        <SkeletonBlock className="mt-3 h-3 w-96 max-w-full" />
        <SkeletonBlock className="mt-5 h-20 w-full bg-slate-100" />
      </section>
      <CardListSkeleton count={4} label={null} />
    </SkeletonStatus>
  );
}

export function ReceiptDetailSkeleton() {
  return (
    <SkeletonStatus label="Cargando recibo..." className="flex h-full flex-col bg-slate-50/50">
      <div className="border-b border-slate-200 bg-white">
        <div className="px-6 py-4">
          <SkeletonBlock className="h-3 w-28" />
        </div>
        <div className="border-t border-slate-100 px-6 py-6 md:px-8">
          <SkeletonBlock className="h-8 w-52" />
          <SkeletonBlock className="mt-3 h-4 w-72 max-w-full" />
        </div>
      </div>
      <div className="p-6 md:p-8">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <SkeletonBlock className="h-12 w-40" />
                <SkeletonBlock className="h-14 w-32" />
              </div>
              <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
                {Array.from({ length: 2 }, (_, index) => (
                  <div key={index} className="space-y-5">
                    <SkeletonBlock className="h-3 w-32" />
                    <SkeletonBlock className="h-4 w-44" />
                    <SkeletonBlock className="h-3 w-28" />
                  </div>
                ))}
              </div>
            </div>
            <SkeletonBlock className="h-44 w-full bg-white" />
          </div>
          <SkeletonBlock className="h-40 w-full bg-white" />
        </div>
      </div>
    </SkeletonStatus>
  );
}

type AdminPaymentProofsPanelProps = {
  proofs: ReceiptPaymentProofView[];
  receipt?: Receipt;
  pendingReceipts?: Receipt[];
  pendingActionId?: string | null;
  reviewComments: Record<string, string>;
  title?: string;
  emptyDescription?: string;
  buildingById?: Map<string, ReceiptBuildingLookup>;
  unitById?: Map<string, ReceiptUnitLookup>;
  onOpenProof: (proof: ReceiptPaymentProofView) => void;
  onViewReceipt?: (receiptId: string) => void;
  onReviewCommentChange: (proofId: string, comment: string) => void;
  onApprove: (proofId: string) => void | Promise<void>;
  onReject: (proofId: string) => void | Promise<void>;
};

function receiptActionKey(receiptId: string, action: 'PAID' | 'CANCELLED') {
  return `${receiptId}:${action}`;
}

function PendingReceiptActions({
  receipt,
  pendingActionId,
  onMarkPaid,
  onCancelReceipt,
}: {
  receipt: Receipt;
  pendingActionId?: string | null;
  onMarkPaid?: (receipt: Receipt) => void | Promise<void>;
  onCancelReceipt?: (receipt: Receipt) => void | Promise<void>;
}) {
  if (receipt.status !== 'PENDING' || (!onMarkPaid && !onCancelReceipt)) return null;

  const markPaidKey = receiptActionKey(receipt.id, 'PAID');
  const cancelKey = receiptActionKey(receipt.id, 'CANCELLED');

  return (
    <>
      {onMarkPaid ? (
        <button
          type="button"
          disabled={pendingActionId === markPaidKey || Boolean(pendingActionId)}
          onClick={(event) => {
            event.stopPropagation();
            void onMarkPaid(receipt);
          }}
          className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all disabled:opacity-60"
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          {pendingActionId === markPaidKey ? 'Marcando...' : 'Pagado'}
        </button>
      ) : null}
      {onCancelReceipt ? (
        <button
          type="button"
          disabled={pendingActionId === cancelKey || Boolean(pendingActionId)}
          onClick={(event) => {
            event.stopPropagation();
            void onCancelReceipt(receipt);
          }}
          className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all disabled:opacity-60"
        >
          <XCircle className="w-3.5 h-3.5 mr-1" />
          {pendingActionId === cancelKey ? 'Anulando...' : 'Anular'}
        </button>
      ) : null}
    </>
  );
}

export function AdminReceiptsList({
  receipts,
  buildingById,
  unitById,
  pendingActionId,
  onView,
  onMarkPaid,
  onCancelReceipt,
}: AdminReceiptsListProps) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {receipts.map((receipt) => {
        const building = buildingById.get(receipt.buildingId);
        const unit = unitById.get(receipt.unitId);

        return (
          <ReceiptRow
            key={receipt.id}
            number={receipt.number}
            date={receipt.issueDate}
            amount={receipt.amount}
            currency={receipt.currency}
            status={receipt.status}
            description={receipt.description}
            meta={
              <div className="flex flex-wrap gap-1.5">
                {building?.clientId ? (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                    {labelClient(building.clientId)}
                  </span>
                ) : null}
                <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  {building?.name ?? receipt.buildingId}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  Unidad {unit?.number ?? receipt.unitId}
                </span>
              </div>
            }
            actions={
              <PendingReceiptActions
                receipt={receipt}
                pendingActionId={pendingActionId}
                onMarkPaid={onMarkPaid}
                onCancelReceipt={onCancelReceipt}
              />
            }
            onView={() => onView(receipt.id)}
          />
        );
      })}
    </div>
  );
}

export function ReceiptComposerDialog({
  isOpen,
  buildings,
  units,
  buildingId,
  unitId,
  amount,
  currency,
  description,
  issueDate,
  dueDate,
  error,
  isSubmitting,
  onClose,
  onBuildingChange,
  onUnitChange,
  onAmountChange,
  onCurrencyChange,
  onDescriptionChange,
  onIssueDateChange,
  onDueDateChange,
  onSubmit,
}: ReceiptComposerDialogProps) {
  if (!isOpen) return null;

  const unitOptions = units.filter((unit) => unit.buildingId === buildingId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cerrar" type="button" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-black text-slate-900">Emitir recibo</p>
            <p className="mt-1 text-xs text-slate-500 font-medium">Registra un cobro manual para una unidad activa.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700 disabled:opacity-60">
            Cerrar
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Edificio</label>
            <select
              value={buildingId}
              onChange={(event) => onBuildingChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            >
              <option value="">Selecciona un edificio...</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Unidad</label>
            <select
              value={unitId}
              onChange={(event) => onUnitChange(event.target.value)}
              disabled={!buildingId}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium disabled:opacity-70"
            >
              <option value="">Selecciona una unidad...</option>
              {unitOptions.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  Unidad {unit.number}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Monto</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              placeholder="Ej: 250"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Moneda</label>
            <select
              value={currency}
              onChange={(event) => onCurrencyChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            >
              <option value="PEN">PEN</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Fecha de emision</label>
            <input
              type="date"
              value={issueDate}
              onChange={(event) => onIssueDateChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Fecha de vencimiento</label>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => onDueDateChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Descripción (opcional)</label>
            <input
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              placeholder="Ej: Mantenimiento mensual"
            />
          </div>
        </div>

        {error ? <div className="mt-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl px-4 py-3 text-sm font-bold">{error}</div> : null}

        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all disabled:opacity-70"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={isSubmitting}
            className="px-5 py-3 rounded-xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-70"
          >
            {isSubmitting ? 'Emitiendo...' : 'Emitir recibo'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminReceiptHeaderActions({
  receipt,
  pendingActionId,
  onMarkPaid,
  onCancelReceipt,
  onEdit,
  editDisabledReason,
  onPrint,
}: AdminReceiptHeaderActionsProps) {
  return (
    <>
      <button
        type="button"
        onClick={() => onEdit?.(receipt)}
        disabled={!onEdit}
        aria-disabled={!onEdit}
        aria-label="Editar recibo"
        title={onEdit ? 'Editar recibo' : editDisabledReason || 'No disponible'}
        className={`p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm ${onEdit ? 'text-slate-600 hover:text-primary' : 'text-slate-400 cursor-not-allowed opacity-70'}`}
      >
        <Edit2 className="w-4 h-4 group-hover:text-primary transition-colors" />
      </button>
      <button
        type="button"
        onClick={() => onPrint?.(receipt)}
        disabled={!onPrint}
        aria-disabled={!onPrint}
        aria-label="Imprimir recibo"
        title={onPrint ? 'Imprimir / guardar PDF' : 'No disponible'}
        className={`p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm ${onPrint ? 'text-slate-600 hover:text-primary' : 'text-slate-400 cursor-not-allowed opacity-70'}`}
      >
        <Printer className="w-4 h-4 group-hover:text-primary transition-colors" />
      </button>
      <PendingReceiptActions
        receipt={receipt}
        pendingActionId={pendingActionId}
        onMarkPaid={onMarkPaid}
        onCancelReceipt={onCancelReceipt}
      />
    </>
  );
}

export function AdminReceiptDetailView({
  receipt,
  building,
  unit,
  actions,
  paymentProofPanel,
  onDelete,
  isDeleting = false,
}: AdminReceiptDetailViewProps) {
  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-4">
          <Link href="/admin/receipts" className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-primary uppercase tracking-widest transition-colors">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Volver a Recibos
          </Link>
        </div>
        <div className="border-t border-slate-100">
          <div className="px-6 md:px-8 py-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-3xl font-black text-slate-900 truncate">Recibo {receipt.number}</p>
              <p className="mt-1 text-sm font-medium text-slate-500">{receipt.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">{actions}</div>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Estado de Pago</p>
                    <div className="mt-0.5">
                      <StatusBadge status={receipt.status} />
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Monto Total</p>
                  <p className="text-2xl font-black text-slate-900">{formatReceiptAmount(receipt.amount, receipt.currency)}</p>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1.5" /> Fecha de Emision
                    </p>
                    <p className="text-sm font-bold text-slate-700">
                      {formatReceiptDate(receipt.issueDate, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-rose-500" /> Fecha de Vencimiento
                    </p>
                    <p className="text-sm font-bold text-rose-600">
                      {formatReceiptDate(receipt.dueDate, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center">
                      <BuildingIcon className="w-3.5 h-3.5 mr-1.5" /> Edificio
                    </p>
                    <p className="text-sm font-bold text-slate-700">{building?.name || 'N/A'}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {building?.clientId ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                          {labelClient(building.clientId)}
                        </span>
                      ) : null}
                      <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                        {building?.address || 'Dirección N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center">
                      <Home className="w-3.5 h-3.5 mr-1.5" /> Unidad / Departamento
                    </p>
                    <p className="text-sm font-bold text-slate-700">Unidad {unit?.number || 'N/A'}</p>
                    <p className="text-xs text-slate-400 font-medium">Piso {unit?.floor || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
            {paymentProofPanel}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Acciones Criticas</p>
                <button
                  type="button"
                  onClick={() => void onDelete?.(receipt)}
                  disabled={!onDelete || isDeleting}
                  aria-disabled={!onDelete || isDeleting}
                  title={onDelete ? 'Eliminar recibo' : 'No disponible'}
                  className={`w-full flex items-center justify-center px-4 py-3 rounded-2xl font-bold text-xs border transition-all ${
                    onDelete
                      ? 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100'
                      : 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                  } ${isDeleting ? 'opacity-70' : ''}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> {isDeleting ? 'Eliminando...' : 'Eliminar recibo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResidentReceiptsOverview({
  pendingAmountLabel,
  latestPaidAmountLabel,
}: ResidentReceiptsOverviewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="p-8 bg-white rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between group hover:border-primary/20 transition-all cursor-default">
        <div className="space-y-1">
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Deuda pendiente</p>
          <p className="text-4xl font-black text-slate-900 group-hover:text-primary transition-colors leading-tight">
            {pendingAmountLabel}
          </p>
        </div>
        <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center">
          <CreditCard className="w-7 h-7 text-primary" />
        </div>
      </div>

      <div className="p-8 bg-white rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between group hover:border-emerald-200 transition-all cursor-default">
        <div className="space-y-1">
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Último pago</p>
          <p className="text-4xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">
            {latestPaidAmountLabel}
          </p>
        </div>
        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center">
          <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResidentReceiptsList({
  receipts,
  proofsByReceiptId = {},
  buildingById = new Map(),
  unitById = new Map(),
  onView,
}: ResidentReceiptsListProps) {
  return (
    <div className="grid grid-cols-1 gap-4 max-w-4xl">
      {receipts.map((receipt) => {
        const proof = latestPaymentProof(proofsByReceiptId[receipt.id] ?? []);
        const buildingName = buildingById.get(receipt.buildingId)?.name ?? receipt.buildingId;
        const unitNumber = unitById.get(receipt.unitId)?.number ?? receipt.unitId;
        const dueDateLabel = formatReceiptDate(receipt.dueDate);

        const meta = (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-600">
                {buildingName}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-600">
                Unidad {unitNumber}
              </span>
              <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Vence {dueDateLabel}
              </span>
            </div>
            {proof ? <PaymentProofStatusPill status={proof.status} /> : null}
          </div>
        );

        return (
          <ReceiptRow
            key={receipt.id}
            number={receipt.number}
            date={receipt.issueDate}
            amount={receipt.amount}
            currency={receipt.currency}
            status={receipt.status}
            description={receipt.description}
            meta={meta}
            onView={() => onView(receipt.id)}
          />
        );
      })}
    </div>
  );
}

function paymentProofStatusLabel(status: ReceiptPaymentProofView['status']) {
  if (status === 'PENDING_REVIEW') return 'Pendiente de revisión';
  if (status === 'APPROVED') return 'Aprobado';
  return 'Rechazado';
}

function paymentProofStatusClasses(status: ReceiptPaymentProofView['status']) {
  if (status === 'PENDING_REVIEW') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (status === 'APPROVED') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  return 'bg-rose-50 text-rose-700 border-rose-100';
}

function latestPaymentProof(proofs: ReceiptPaymentProofView[]) {
  return [...proofs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}

function sortPaymentProofsForReview(proofs: ReceiptPaymentProofView[]) {
  const statusPriority: Record<ReceiptPaymentProofView['status'], number> = {
    PENDING_REVIEW: 0,
    REJECTED: 1,
    APPROVED: 2,
  };

  return [...proofs].sort((a, b) => {
    const statusDiff = statusPriority[a.status] - statusPriority[b.status];
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function PaymentProofStatusPill({ status }: { status: ReceiptPaymentProofView['status'] }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${paymentProofStatusClasses(status)}`}>
      {status === 'PENDING_REVIEW' ? <Clock className="mr-1.5 h-3 w-3" /> : null}
      {status === 'APPROVED' ? <CheckCircle2 className="mr-1.5 h-3 w-3" /> : null}
      {status === 'REJECTED' ? <XCircle className="mr-1.5 h-3 w-3" /> : null}
      {paymentProofStatusLabel(status)}
    </span>
  );
}

function PaymentProofSummary({ proof, onOpenProof }: { proof: ReceiptPaymentProofView; onOpenProof?: (proof: ReceiptPaymentProofView) => void }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <PaymentProofStatusPill status={proof.status} />
          <div className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-800">
            <FileText className="h-4 w-4 text-primary" />
            <span className="truncate">{proof.fileName}</span>
          </div>
          {proof.note ? <p className="mt-2 text-xs font-medium text-slate-500">{proof.note}</p> : null}
          {proof.reviewComment ? (
            <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600">Comentario: {proof.reviewComment}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onOpenProof?.(proof)}
          disabled={!onOpenProof}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ExternalLink className="mr-2 h-3.5 w-3.5" /> Ver archivo
        </button>
      </div>
    </div>
  );
}

export function ResidentPaymentProofPanel({
  receipt,
  proofs,
  selectedFile,
  note,
  isSubmitting,
  error,
  message,
  onFileChange,
  onNoteChange,
  onUpload,
  onOpenProof,
}: ResidentPaymentProofPanelProps) {
  const activeProof = proofs.find((proof) => proof.status === 'PENDING_REVIEW' || proof.status === 'APPROVED') ?? null;
  const latestProof = latestPaymentProof(proofs);
  const canUpload = receipt.status === 'PENDING' && !activeProof;

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lg font-black text-slate-900">Comprobante de pago</p>
          <p className="mt-1 text-sm font-medium text-slate-500">Sube el archivo luego de pagar por transferencia o canal externo.</p>
        </div>
        {latestProof ? <PaymentProofStatusPill status={latestProof.status} /> : null}
      </div>

      <div className="mt-5 space-y-4">
        {latestProof ? <PaymentProofSummary proof={latestProof} onOpenProof={onOpenProof} /> : null}

        {activeProof?.status === 'PENDING_REVIEW' ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            Tu comprobante fue enviado y está pendiente de revisión. La administración lo aprobará o rechazará.
          </div>
        ) : null}

        {latestProof?.status === 'REJECTED' && !activeProof ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            El comprobante anterior fue rechazado. Puedes subir un nuevo archivo para revisión.
          </div>
        ) : null}
        {canUpload ? (
          <div className="space-y-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4">
            <div>
              <label htmlFor="payment-proof-file" className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Archivo del comprobante
              </label>
              <input
                id="payment-proof-file"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-black file:text-primary"
              />
              {selectedFile ? <p className="mt-2 text-xs font-bold text-slate-500">Seleccionado: {selectedFile.name}</p> : null}
            </div>
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              rows={3}
              placeholder="Nota opcional: banco, operación o referencia"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/5"
            />
            <button
              type="button"
              onClick={() => void onUpload()}
              disabled={isSubmitting}
              className="inline-flex items-center rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-60"
            >
              <Upload className="mr-2 h-4 w-4" /> {isSubmitting ? 'Subiendo...' : 'Subir comprobante'}
            </button>
          </div>
        ) : null}

        {!canUpload && !activeProof && receipt.status !== 'PENDING' ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
            Este recibo no admite nuevos comprobantes porque su estado actual es {labelReceiptStatus(receipt.status)}.
          </div>
        ) : null}

        {message ? <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
      </div>
    </section>
  );
}

export function AdminPaymentProofsPanel({
  proofs,
  receipt,
  pendingReceipts = [],
  pendingActionId,
  reviewComments,
  title = 'Comprobantes de pago',
  emptyDescription = 'No hay comprobantes registrados para revisar.',
  buildingById,
  unitById,
  onOpenProof,
  onViewReceipt,
  onReviewCommentChange,
  onApprove,
  onReject,
}: AdminPaymentProofsPanelProps) {
  const receiptHasProofs = receipt ? proofs.some((proof) => proof.receiptId === receipt.id) : false;
  const receiptsToRender = receipt ? (receiptHasProofs ? [receipt] : []) : pendingReceipts;
  const hasContent = receiptsToRender.length > 0;

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-1">
        <p className="text-lg font-black text-slate-900">{title}</p>
        <p className="text-sm font-medium text-slate-500">Revisa archivos subidos por residentes antes de marcar un recibo como pagado.</p>
      </div>

      <div className="mt-5 space-y-4">
        {!hasContent ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm font-bold text-slate-500">
            {emptyDescription}
          </div>
        ) : null}

        {receiptsToRender.map((item) => {
          const receiptProofs = sortPaymentProofsForReview(proofs.filter((proof) => proof.receiptId === item.id));
          const buildingId = item.buildingId;
          const unitId = item.unitId;
          const buildingName = buildingById?.get(buildingId)?.name ?? buildingId;
          const unitNumber = unitById?.get(unitId)?.number ?? unitId;

          return (
            <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black text-slate-900">{item.number}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-600">{item.description || 'Recibo pendiente de gestión'}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {buildingName} - Unidad {unitNumber}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {formatReceiptAmount(item.amount, item.currency)} - Vence {formatReceiptDate(item.dueDate)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {onViewReceipt ? (
                    <button
                      type="button"
                      onClick={() => onViewReceipt(item.id)}
                      className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                    >
                      Ver detalle
                    </button>
                  ) : null}
                </div>
              </div>
              {receiptProofs.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {receiptProofs.map((proof) => {
                    const isPending = proof.status === 'PENDING_REVIEW';
                    const approveId = `${proof.id}:APPROVE`;
                    const rejectId = `${proof.id}:REJECT`;

                    return (
                      <div key={proof.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <PaymentProofStatusPill status={proof.status} />
                              {!isPending ? (
                                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Historial</span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-xs font-bold text-slate-700">{proof.fileName}</p>
                            {proof.note ? <p className="mt-1 text-xs font-medium text-slate-500">{proof.note}</p> : null}
                            {proof.reviewComment ? (
                              <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                                Comentario: {proof.reviewComment}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenProof(proof)}
                              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                            >
                              <ExternalLink className="mr-2 h-3.5 w-3.5" /> Ver archivo
                            </button>
                            {isPending ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void onApprove(proof.id)}
                                  disabled={Boolean(pendingActionId)}
                                  className="inline-flex items-center rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                                >
                                  <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> {pendingActionId === approveId ? 'Aprobando...' : 'Aprobar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onReject(proof.id)}
                                  disabled={Boolean(pendingActionId)}
                                  className="inline-flex items-center rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                >
                                  <XCircle className="mr-2 h-3.5 w-3.5" /> {pendingActionId === rejectId ? 'Rechazando...' : 'Rechazar'}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                        {isPending ? (
                          <textarea
                            value={reviewComments[proof.id] ?? ''}
                            onChange={(event) => onReviewCommentChange(proof.id, event.target.value)}
                            rows={2}
                            placeholder="Comentario opcional para la revisión"
                            className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/5"
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-400">
                  Sin comprobante cargado todavia.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
export function ResidentReceiptHeaderActions({
  receipt,
  receiptStatus,
  onPrint,
  onPay,
  isPaying,
}: ResidentReceiptHeaderActionsProps) {
  return (
    <>
      <button
        type="button"
        onClick={() => onPrint?.(receipt)}
        disabled={!onPrint}
        aria-disabled={!onPrint}
        title={onPrint ? 'Imprimir / guardar PDF' : 'No disponible'}
        className={`flex items-center px-4 py-2.5 rounded-xl font-bold text-sm ${onPrint ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-100 text-slate-500 cursor-not-allowed'}`}
      >
        <Printer className="w-4 h-4 mr-2" /> Imprimir / guardar PDF
      </button>
      {receiptStatus !== 'PAID' && onPay ? (
        <button
          type="button"
          onClick={() => void onPay(receipt)}
          disabled={Boolean(isPaying)}
          aria-disabled={Boolean(isPaying)}
          title="Registrar pago"
          className={`flex items-center px-6 py-2.5 rounded-xl bg-primary text-white font-black text-sm hover:bg-primary/90 ${isPaying ? 'opacity-70' : ''}`}
        >
          <CreditCard className="w-4 h-4 mr-2" /> {isPaying ? 'Procesando...' : 'Pagar'}
        </button>
      ) : null}
    </>
  );
}

export function ResidentReceiptDetailView({
  receipt,
  building,
  unit,
  actions,
  paymentProofPanel,
}: ResidentReceiptDetailViewProps) {
  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-4">
          <Link
            href="/resident/receipts"
            className="inline-flex items-center text-xs font-black text-slate-400 hover:text-primary uppercase tracking-[0.2em] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Mis Recibos
          </Link>
        </div>
        <div className="border-t border-slate-100">
          <div className="px-6 md:px-8 py-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-3xl font-black text-slate-900 truncate">Detalle de Cobro</p>
              <p className="mt-1 text-sm font-medium text-slate-500">{receipt.number}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">{actions}</div>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex flex-col gap-6 border-b border-slate-100 p-8 md:flex-row md:items-start md:justify-between md:p-10">
              <div className="min-w-0 space-y-4">
                <StatusBadge status={receipt.status} />
                <div className="space-y-1">
                  <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{receipt.description}</h2>
                  <p className="text-sm font-medium text-slate-500">{building?.name ?? 'Edificio'}</p>
                </div>
                <div className="flex flex-wrap gap-3 sm:gap-6">
                  <div className="flex items-center text-slate-500 font-medium">
                    <Calendar className="w-4 h-4 mr-2 text-primary" />
                    {formatReceiptDate(receipt.issueDate, { month: 'long', year: 'numeric' })}
                  </div>
                  <div className="flex items-center text-slate-500 font-medium">
                    <BuildingIcon className="w-4 h-4 mr-2 text-primary" />
                    {building?.name ?? 'Edificio'}
                  </div>
                  <div className="flex items-center text-slate-500 font-medium">
                    <Home className="w-4 h-4 mr-2 text-primary" />
                    Depto {unit?.number ?? '-'}
                  </div>
                </div>
              </div>
              <div className="w-full rounded-[1.5rem] border border-slate-100 bg-slate-50 p-6 text-left md:min-w-[220px] md:w-auto md:text-right md:p-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total a Pagar</p>
                <p className="text-3xl font-black text-primary sm:text-4xl">{formatReceiptAmount(receipt.amount, receipt.currency)}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Vence el {formatReceiptDate(receipt.dueDate)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 p-8 md:grid-cols-2 md:p-10">
              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1.5" /> Fecha de Emision
                  </p>
                  <p className="text-sm font-bold text-slate-700">
                    {formatReceiptDate(receipt.issueDate, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-rose-500" /> Fecha de Vencimiento
                  </p>
                  <p className="text-sm font-bold text-rose-600">
                    {formatReceiptDate(receipt.dueDate, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center">
                    <BuildingIcon className="w-3.5 h-3.5 mr-1.5" /> Edificio
                  </p>
                  <p className="text-sm font-bold text-slate-700">{building?.name ?? 'N/A'}</p>
                  <p className="text-xs text-slate-400 font-medium">{building?.address ?? 'Dirección N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center">
                    <Home className="w-3.5 h-3.5 mr-1.5" /> Unidad / Departamento
                  </p>
                  <p className="text-sm font-bold text-slate-700">Depto {unit?.number ?? 'N/A'}</p>
                  <p className="text-xs text-slate-400 font-medium">Piso {unit?.floor ?? '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {paymentProofPanel}

          <div className="flex items-center justify-center p-6 bg-primary/5 rounded-3xl border border-primary/10">
            <p className="text-xs text-slate-600 font-medium">
              Si tienes dudas sobre este cobro, contacta a la administración de <span className="font-bold">{building?.name ?? 'tu edificio'}</span> por el canal oficial.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
