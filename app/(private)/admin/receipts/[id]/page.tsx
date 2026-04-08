'use client';

import React, { use, useEffect, useState } from 'react';
import { PageHeader } from "@/components/PageHeader";
import { MOCK_BUILDINGS, MOCK_UNITS } from "@/lib/mocks";
import { ErrorState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/Receipts";
import { ArrowLeft, Download, Printer, Send, Trash2, Edit2, Calendar, CreditCard, Building, Home, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { receiptsRepo } from '@/lib/data';
import { Receipt } from '@/lib/types';

export default function AdminReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
        <ErrorState title="Error" description={loadError} action={
          <button 
            onClick={() => router.push('/admin/receipts')}
            className="flex items-center bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver a la lista
          </button>
        } />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <ErrorState 
          title="Recibo no encontrado" 
          description="El identificador del recibo no existe o ha sido eliminado."
          action={
            <button 
              onClick={() => router.push('/admin/receipts')}
              className="flex items-center bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Volver a la lista
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
      <button className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:border-slate-300 transition-all shadow-sm group">
        <Edit2 className="w-4 h-4 group-hover:text-primary transition-colors" />
      </button>
      <button className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:border-slate-300 transition-all shadow-sm group">
        <Printer className="w-4 h-4 group-hover:text-primary transition-colors" />
      </button>
      <button className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:border-slate-300 transition-all shadow-sm group">
        <Download className="w-4 h-4 group-hover:text-primary transition-colors" />
      </button>
      <button className="flex items-center px-4 py-2.5 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
        <Send className="w-4 h-4 mr-2" /> Enviar por Email
      </button>
    </>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-4">
          <Link href="/admin/receipts" className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-primary uppercase tracking-widest transition-colors">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Volver a Recibos
          </Link>
        </div>
        <PageHeader 
          title={`Recibo ${receipt.number}`} 
          description={receipt.description}
          actions={actions}
        />
      </div>

      <div className="p-6 md:p-8">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Detail Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Estado de Pago</p>
                    <div className="mt-0.5"><StatusBadge status={receipt.status} /></div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Monto Total</p>
                  <p className="text-2xl font-black text-slate-900">${receipt.amount.toLocaleString('es-CL')} <span className="text-sm font-bold text-slate-400">{receipt.currency}</span></p>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1.5" /> Fecha de Emisión
                    </p>
                    <p className="text-sm font-bold text-slate-700">{new Date(receipt.issueDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-rose-500" /> Fecha de Vencimiento
                    </p>
                    <p className="text-sm font-bold text-rose-600">{new Date(receipt.dueDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center">
                      <Building className="w-3.5 h-3.5 mr-1.5" /> Edificio
                    </p>
                    <p className="text-sm font-bold text-slate-700">{building?.name || 'N/A'}</p>
                    <p className="text-xs text-slate-400 font-medium">{building?.address}</p>
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

            {/* Items List (Placeholder for real data) */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Detalle de Cobros</h3>
                <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-widest">2 ítems</span>
              </div>
              <div className="divide-y divide-slate-50">
                <div className="p-6 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-700">Gastos Comunes</p>
                    <p className="text-xs text-slate-400 font-medium">Mantenimiento mensual de áreas comunes</p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">${(receipt.amount * 0.85).toLocaleString('es-CL')}</p>
                </div>
                <div className="p-6 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-700">Fondo de Reserva</p>
                    <p className="text-xs text-slate-400 font-medium">Aporte mensual para emergencias</p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">${(receipt.amount * 0.15).toLocaleString('es-CL')}</p>
                </div>
              </div>
              <div className="p-6 bg-slate-50/50 flex items-center justify-between">
                <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Total</p>
                <p className="text-lg font-black text-primary">${receipt.amount.toLocaleString('es-CL')}</p>
              </div>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Asignado a</p>
                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">Residente Juan</p>
                    <p className="text-[10px] text-slate-400 font-medium">Propiedad de Inversión</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Acciones Críticas</p>
                <button className="w-full flex items-center justify-center px-4 py-3 bg-red-50 text-red-600 rounded-2xl font-bold text-xs hover:bg-red-100 transition-all border border-red-100 group">
                  <Trash2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" /> Anular Recibo
                </button>
              </div>
            </div>

            <div className="bg-primary/5 rounded-3xl p-8 border border-primary/10">
              <h4 className="text-sm font-black text-primary uppercase tracking-widest mb-2">Nota del Administrador</h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Este recibo incluye un cargo retroactivo por el mantenimiento del ascensor del mes pasado que no fue facturado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
