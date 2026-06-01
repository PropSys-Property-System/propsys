'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isUp: boolean;
  };
  variant?: 'primary' | 'emerald' | 'amber' | 'rose' | 'slate';
}

const VARIANTS = {
  primary: 'text-primary bg-primary/10',
  emerald: 'text-emerald-600 bg-emerald-50',
  amber: 'text-amber-600 bg-amber-50',
  rose: 'text-rose-600 bg-rose-50',
  slate: 'text-slate-600 bg-slate-50',
};

export function KPICard({ title, value, icon: Icon, description, trend, variant = 'primary' }: KPICardProps) {
  return (
    <div className="group rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md md:p-6">
      <div className="mb-3 flex items-start justify-between md:mb-4">
        <div className={cn("rounded-2xl p-2.5 transition-transform duration-300 group-hover:scale-110 md:p-3", VARIANTS[variant])}>
          <Icon className="h-5 w-5 md:h-6 md:w-6" />
        </div>
        {trend && (
          <div className={cn(
            "flex items-center px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
            trend.isUp ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          )}>
            {trend.isUp ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {trend.value}%
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <h3 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h3>
        {description && (
          <p className="text-xs text-slate-500 font-medium mt-2">{description}</p>
        )}
      </div>
    </div>
  );
}

