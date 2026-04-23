import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building as BuildingIcon, Calendar, CreditCard, Download, Edit2, Home, Printer, Send, Trash2 } from 'lucide-react';
import { ReceiptRow, StatusBadge } from '@/components/Receipts';
import { formatReceiptAmount, formatReceiptDate } from '@/lib/presentation/receipts';
import { labelClient } from '@/lib/presentation/labels';
import type { Building, Receipt, Unit } from '@/lib/types';

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
  onView: (receiptId: string) => void;
};

type AdminReceiptDetailViewProps = {
  receipt: Receipt;
  building: Building | null;
  unit: Unit | null;
  actions: ReactNode;
};

type ResidentReceiptsOverviewProps = {
  pendingAmountLabel: string;
  latestPaidAmountLabel: string;
};

type ResidentReceiptsListProps = {
  receipts: Receipt[];
  onView: (receiptId: string) => void;
};

type ResidentReceiptHeaderActionsProps = {
  receiptStatus: Receipt['status'];
};

type ResidentReceiptDetailViewProps = {
  receipt: Receipt;
  building: Building | null;
  unit: Unit | null;
  actions: ReactNode;
};

export function AdminReceiptsList({ receipts, buildingById, unitById, onView }: AdminReceiptsListProps) {
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
            onView={() => onView(receipt.id)}
          />
        );
      })}
    </div>
  );
}

export function AdminReceiptHeaderActions() {
  return (
    <>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Proximamente"
        className="p-2.5 bg-white border border-slate-200 text-slate-400 rounded-xl shadow-sm cursor-not-allowed opacity-70"
      >
        <Edit2 className="w-4 h-4 group-hover:text-primary transition-colors" />
      </button>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Proximamente"
        className="p-2.5 bg-white border border-slate-200 text-slate-400 rounded-xl shadow-sm cursor-not-allowed opacity-70"
      >
        <Printer className="w-4 h-4 group-hover:text-primary transition-colors" />
      </button>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Proximamente"
        className="p-2.5 bg-white border border-slate-200 text-slate-400 rounded-xl shadow-sm cursor-not-allowed opacity-70"
      >
        <Download className="w-4 h-4 group-hover:text-primary transition-colors" />
      </button>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Proximamente"
        className="flex items-center px-4 py-2.5 bg-slate-100 text-slate-500 rounded-xl font-bold text-sm cursor-not-allowed"
      >
        <Send className="w-4 h-4 mr-2" /> Proximamente
      </button>
    </>
  );
}

export function AdminReceiptDetailView({ receipt, building, unit, actions }: AdminReceiptDetailViewProps) {
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
                        {building?.address || 'Direccion N/A'}
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
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Acciones Criticas</p>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Proximamente"
                  className="w-full flex items-center justify-center px-4 py-3 bg-slate-100 text-slate-500 rounded-2xl font-bold text-xs cursor-not-allowed border border-slate-200"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Proximamente
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
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Deuda Pendiente</p>
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
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Ultimo Pago</p>
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

export function ResidentReceiptsList({ receipts, onView }: ResidentReceiptsListProps) {
  return (
    <div className="grid grid-cols-1 gap-4 max-w-4xl">
      {receipts.map((receipt) => (
        <ReceiptRow
          key={receipt.id}
          number={receipt.number}
          date={receipt.issueDate}
          amount={receipt.amount}
          currency={receipt.currency}
          status={receipt.status}
          description={receipt.description}
          onView={() => onView(receipt.id)}
        />
      ))}
    </div>
  );
}

export function ResidentReceiptHeaderActions({ receiptStatus }: ResidentReceiptHeaderActionsProps) {
  return (
    <>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Proximamente"
        className="flex items-center px-4 py-2.5 bg-slate-100 text-slate-500 rounded-xl font-bold text-sm cursor-not-allowed"
      >
        <Download className="w-4 h-4 mr-2" /> Proximamente
      </button>
      {receiptStatus !== 'PAID' ? (
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Proximamente"
          className="flex items-center px-6 py-2.5 bg-slate-100 text-slate-500 rounded-xl font-black text-sm cursor-not-allowed"
        >
          <CreditCard className="w-4 h-4 mr-2" /> Proximamente
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
                  <p className="text-xs text-slate-400 font-medium">{building?.address ?? 'Direccion N/A'}</p>
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
