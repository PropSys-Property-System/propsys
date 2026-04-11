'use client';

import React from 'react';
import { PackageOpen, AlertCircle, Loader2 } from 'lucide-react';

interface StateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: StateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border-2 border-dashed border-slate-200 rounded-xl">
      <div className="p-4 bg-slate-50 rounded-full mb-4">
        <PackageOpen className="w-12 h-12 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mt-2">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, description, action }: StateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-red-50 border border-red-100 rounded-xl">
      <div className="p-4 bg-red-100 rounded-full mb-4 text-red-600">
        <AlertCircle className="w-12 h-12" />
      </div>
      <h3 className="text-lg font-semibold text-red-900">{title}</h3>
      <p className="text-sm text-red-700 max-w-sm mt-2">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function LoadingState({ title = "Cargando..." }: { title?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
      <p className="text-sm text-slate-500 font-medium">{title}</p>
    </div>
  );
}

