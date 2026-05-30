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

type SkeletonBlockProps = {
  className?: string;
};

type SkeletonStatusProps = {
  label: string;
  className?: string;
  children: React.ReactNode;
};

type CardListSkeletonProps = {
  count?: number;
  label?: string | null;
};

export function SkeletonBlock({ className = '' }: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="skeleton-block"
      className={`rounded-xl bg-slate-200/80 motion-safe:animate-pulse motion-reduce:animate-none ${className}`}
    />
  );
}

export function SkeletonStatus({ label, className = '', children }: SkeletonStatusProps) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function CardListSkeleton({ count = 3, label = 'Cargando contenido...' }: CardListSkeletonProps) {
  const content = (
    <div className="grid grid-cols-1 gap-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <SkeletonBlock className="h-10 w-10 flex-shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-36 max-w-full" />
              <SkeletonBlock className="h-3 w-56 max-w-full" />
              <SkeletonBlock className="h-3 w-44 max-w-full" />
            </div>
          </div>
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );

  return label ? <SkeletonStatus label={label}>{content}</SkeletonStatus> : content;
}

