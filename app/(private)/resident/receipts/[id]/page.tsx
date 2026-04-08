'use client';

import React, { use, useEffect, useState } from 'react';
import { PageHeader } from "@/components/PageHeader";
import { MOCK_BUILDINGS, MOCK_UNITS } from "@/lib/mocks";
import { ErrorState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/Receipts";
import { ArrowLeft, Download, CreditCard, Calendar, Building, Home, FileText, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { receiptsRepo } from '@/lib/data';
import { Receipt } from '@/lib/types';

interface PageParams {
  id: string;
}

export default function ResidentReceiptDetailPage({ params }: { params: Promise<PageParams> }) {
  const router = useRouter();
  const { user } = useAuth();
  const resolvedParams = use(params);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setLoadError(null);
        const r = await receiptsRepo.getByIdForUser(user, resolvedParams.id);
        if (!isMounted) return;
        setReceipt(r);
      } catch {
        if (!isMounted) return;
        setLoadError('No pudimos cargar el recibo.');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [user, resolvedParams.id]);
  
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <LoadingState title="Cargando recibo..." />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <ErrorState
          title="Error"
          description={loadError}
          action={
            <button 
              onClick={() => router.push('/resident/receipts')}
              className="flex items-center bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Volver a mis recibos
            </button>
          }
        />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <ErrorState 
          title="Recibo no encontrado" 
          description="No pudimos encontrar el recibo solicitado."
          action={
            <button 
              onClick={() => router.push('/resident/receipts')}
              className="flex items-center bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Volver a mis recibos
            </button>
          }
        />
      </div>
    );
  }

  const building = MOCK_BUILDINGS.find(b => b.id === receipt.buildingId);
  const unit = MOCK_UNITS.find(u => u.id === receipt.unitId);

  const actions = (
    <>
      <button className="flex items-center px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all group">
        <Download className="w-4 h-4 mr-2 group-hover:translate-y-0.5 transition-transform" /> Descargar PDF
      </button>
      {receipt.status !== 'PAID' && (
        <button className="flex items-center px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 group">
          <CreditCard className="w-4 h-4 mr-2 group-hover:-translate-y-0.5 transition-transform" /> Pagar Ahora
        </button>
      )}
    </>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-4">
          <Link href="/resident/receipts" className="inline-flex items-center text-xs font-black text-slate-400 hover:text-primary uppercase tracking-[0.2em] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Mis Recibos
          </Link>
        </div>
        <PageHeader 
          title={`Detalle de Cobro`} 
          description={receipt.number}
          actions={actions}
        />
      </div>

      <div className="p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Main Info Card */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-10 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="space-y-4">
                <StatusBadge status={receipt.status} />
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">{receipt.description}</h2>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center text-slate-500 font-medium">
                    <Calendar className="w-4 h-4 mr-2 text-primary" />
                    {new Date(receipt.issueDate).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
                  </div>
                  <div className="flex items-center text-slate-500 font-medium">
                    <Building className="w-4 h-4 mr-2 text-primary" />
                    {building?.name}
                  </div>
                  <div className="flex items-center text-slate-500 font-medium">
                    <Home className="w-4 h-4 mr-2 text-primary" />
                    Depto {unit?.number}
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 p-8 rounded-[1.5rem] border border-slate-100 text-center md:text-right min-w-[200px]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total a Pagar</p>
                <p className="text-4xl font-black text-primary">${receipt.amount.toLocaleString('es-CL')}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Vence el {new Date(receipt.dueDate).toLocaleDateString('es-CL')}</p>
              </div>
            </div>

            <div className="p-10 space-y-8">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center">
                  <FileText className="w-4 h-4 mr-2" /> Desglose de Gastos
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-700">Gasto Común Ordinario</p>
                      <p className="text-xs text-slate-400 font-medium">Administración, conserjería y servicios básicos</p>
                    </div>
                    <p className="text-sm font-black text-slate-900">${(receipt.amount * 0.85).toLocaleString('es-CL')}</p>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-700">Fondo de Reserva</p>
                      <p className="text-xs text-slate-400 font-medium">Ahorro para mantenciones mayores</p>
                    </div>
                    <p className="text-sm font-black text-slate-900">${(receipt.amount * 0.15).toLocaleString('es-CL')}</p>
                  </div>
                </div>
              </div>

              {receipt.status === 'PAID' && (
                <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start space-x-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 flex-shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-900">Este recibo ya ha sido pagado</p>
                    <p className="text-xs text-emerald-700 font-medium mt-0.5">Comprobante generado el {new Date(receipt.issueDate).toLocaleDateString('es-CL')}.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center p-6 bg-primary/5 rounded-3xl border border-primary/10">
            <Info className="w-5 h-5 text-primary mr-3 flex-shrink-0" />
            <p className="text-xs text-slate-600 font-medium">
              Si tienes dudas sobre este cobro, contacta a la administración de <span className="font-bold">{building?.name}</span> a través del canal oficial de PropSys.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
