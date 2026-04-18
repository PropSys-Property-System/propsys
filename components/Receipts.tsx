'use client';

import React from 'react';
import { ReceiptStatus } from '@/lib/types';
import { formatReceiptAmount, formatReceiptDate } from '@/lib/presentation/receipts';
import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';

const STATUS_CONFIG: Record<ReceiptStatus, { label: string; className: string }> = {
  PENDING: {
    label: 'Pendiente',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  PAID: {
    label: 'Pagado',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  OVERDUE: {
    label: 'Vencido',
    className: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  CANCELLED: {
    label: 'Cancelado',
    className: 'bg-slate-100 text-slate-800 border-slate-200',
  },
};

export function StatusBadge({ status }: { status: ReceiptStatus }) {
  const config = STATUS_CONFIG[status] || {
    label: 'Desconocido',
    className: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors",
      config.className
    )}>
      {config.label}
    </span>
  );
}

export interface ReceiptRowProps {
  number: string;
  date: string;
  amount: number;
  currency: string;
  status: ReceiptStatus;
  description: string;
  meta?: React.ReactNode;
  onView?: () => void;
}

export function ReceiptRow({ number, date, amount, currency, status, description, meta, onView }: ReceiptRowProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onView && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onView();
    }
  };

  const formattedDate = React.useMemo(() => {
    try {
      return formatReceiptDate(date, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Error fecha';
    }
  }, [date]);

  const formattedAmount = React.useMemo(() => {
    try {
      return formatReceiptAmount(amount, currency);
    } catch {
      return '---';
    }
  }, [amount, currency]);

  return (
    <div 
      role={onView ? "button" : "article"}
      tabIndex={onView ? 0 : undefined}
      className={cn(
        "group flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg transition-all",
        onView && "hover:border-primary/30 cursor-pointer focus:ring-2 focus:ring-primary/20 focus:outline-none"
      )}
      onClick={onView}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center space-x-4 min-w-0">
        <div className="p-2 bg-slate-50 rounded-md text-slate-400 group-hover:bg-primary/5 group-hover:text-primary transition-colors">
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-slate-900 truncate">{number}</span>
            <StatusBadge status={status} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{description}</p>
          {meta ? <div className="mt-1.5">{meta}</div> : null}
        </div>
      </div>
      
      <div className="text-right ml-4">
        <p className="text-sm font-bold text-slate-900">
          {formattedAmount}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-semibold">
          {formattedDate}
        </p>
      </div>
    </div>
  );
}

