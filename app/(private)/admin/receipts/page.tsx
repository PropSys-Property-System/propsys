'use client';

import React, { useState } from 'react';
import { PageHeader } from "@/components/PageHeader";
import { ReceiptRow } from "@/components/Receipts";
import { MOCK_RECEIPTS } from "@/lib/mocks";
import { EmptyState } from "@/components/States";
import { Search, Plus, Filter, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminReceiptsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  
  const receipts = MOCK_RECEIPTS.filter(r => 
    r.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const actions = (
    <>
      <button className="flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
        <Download className="w-4 h-4 mr-2" /> Exportar
      </button>
      <button className="flex items-center px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
        <Plus className="w-4 h-4 mr-2" /> Nuevo Recibo
      </button>
    </>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader 
        title="Gestión de Recibos" 
        description="Administra, emite y controla los pagos de la comunidad"
        actions={actions}
      />
      
      <div className="p-6 md:p-8 space-y-6">
        {/* Filtros y Búsqueda */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar por número o descripción..." 
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center justify-center px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:border-slate-300 transition-all">
            <Filter className="w-4 h-4 mr-2" /> Filtros
          </button>
        </div>

        {/* Lista de Recibos */}
        <div className="space-y-3">
          {receipts.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {receipts.map((receipt) => (
                <ReceiptRow
                  key={receipt.id}
                  number={receipt.number}
                  date={receipt.issueDate}
                  amount={receipt.amount}
                  status={receipt.status}
                  description={receipt.description}
                  onView={() => router.push(`/admin/receipts/${receipt.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="py-12">
              <EmptyState 
                title="No se encontraron recibos" 
                description={searchTerm ? `No hay resultados para "${searchTerm}"` : "Aún no se han emitido recibos en el sistema."}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
