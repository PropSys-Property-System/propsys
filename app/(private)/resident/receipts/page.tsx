'use client';

import React, { useState } from 'react';
import { PageHeader } from "@/components/PageHeader";
import { ReceiptRow } from "@/components/Receipts";
import { MOCK_RECEIPTS } from "@/lib/mocks";
import { EmptyState } from "@/components/States";
import { CreditCard, Search, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ResidentReceiptsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  
  const receipts = MOCK_RECEIPTS.filter(r => 
    r.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const actions = (
    <button className="flex items-center px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 group">
      <CreditCard className="w-5 h-5 mr-3 group-hover:-translate-y-1 transition-transform" /> Pagar Todo
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader 
        title="Mis Recibos" 
        description="Gestiona tus gastos comunes y comprobantes de pago de PropSys"
        actions={actions}
      />
      
      <div className="p-6 md:p-8 space-y-8">
        {/* Resumen de Estado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-8 bg-white rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between group hover:border-primary/20 transition-all cursor-default">
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Deuda Pendiente</p>
              <p className="text-4xl font-black text-slate-900 group-hover:text-primary transition-colors">$155.000 <span className="text-xs font-bold text-slate-400">CLP</span></p>
            </div>
            <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center">
              <CreditCard className="w-7 h-7 text-primary" />
            </div>
          </div>
          
          <div className="p-8 bg-white rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between group hover:border-emerald-200 transition-all cursor-default">
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Último Pago</p>
              <p className="text-4xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">$150.000 <span className="text-xs font-bold text-slate-400">CLP</span></p>
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

        {/* Buscador y Filtros */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-slate-100 pb-6">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mr-auto">Historial Reciente</h3>
          <div className="relative group w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar por recibo..." 
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-primary hover:border-primary/20 transition-all">
            <Filter className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de Recibos */}
        <div className="space-y-4">
          {receipts.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 max-w-4xl">
              {receipts.map((receipt) => (
                <ReceiptRow
                  key={receipt.id}
                  number={receipt.number}
                  date={receipt.issueDate}
                  amount={receipt.amount}
                  status={receipt.status}
                  description={receipt.description}
                  onView={() => router.push(`/resident/receipts/${receipt.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 bg-white rounded-3xl border border-dashed border-slate-200">
              <EmptyState 
                title="No tienes recibos" 
                description={searchTerm ? `No hay resultados para "${searchTerm}"` : "Aún no se han emitido recibos para tu unidad."}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
