'use client';

import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between p-6 md:p-8 bg-white border-b border-slate-200">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h2>
        {description && (
          <p className="text-sm text-slate-500">{description}</p>
        )}
      </div>
      {actions && (
        <div className="mt-4 md:mt-0 flex items-center space-x-3">
          {actions}
        </div>
      )}
    </div>
  );
}

