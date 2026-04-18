'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from "@/components/PageHeader";
import { ReceiptRow } from "@/components/Receipts";
import { EmptyState } from "@/components/States";
import { Search, Plus, Filter, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { buildingsRepo, receiptsRepo, unitsRepo } from '@/lib/data';
import { Receipt } from '@/lib/types';
import { labelClient } from '@/lib/presentation/labels';

export default function AdminReceiptsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allReceipts, setAllReceipts] = useState<Receipt[]>([]);
  const [buildings, setBuildings] = useState<{ id: string; name: string; clientId?: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; buildingId: string; number: string }[]>([]);
  const router = useRouter();
  
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setError(null);
        const [data, b, u] = await Promise.all([
          receiptsRepo.listForUser(user),
          buildingsRepo.listForUser(user),
          unitsRepo.listForUser(user),
        ]);
        if (!isMounted) return;
        setAllReceipts(data);
        setBuildings(b.map((x) => ({ id: x.id, name: x.name, clientId: x.clientId })));
        setUnits(u.map((x) => ({ id: x.id, buildingId: x.buildingId, number: x.number })));
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar los recibos. Intenta nuevamente.');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const receipts = useMemo(() => {
    return allReceipts.filter((r) => {
      const t = searchTerm.toLowerCase();
      return r.number.toLowerCase().includes(t) || r.description.toLowerCase().includes(t);
    });
  }, [allReceipts, searchTerm]);

  const buildingById = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  const actions = (
    <>
      <button disabled className="flex items-center px-4 py-2 bg-slate-100 text-slate-400 rounded-xl font-bold text-sm cursor-not-allowed">
        <Download className="w-4 h-4 mr-2" /> Próximamente
      </button>
      <button disabled className="flex items-center px-4 py-2 bg-slate-100 text-slate-400 rounded-xl font-bold text-sm cursor-not-allowed">
        <Plus className="w-4 h-4 mr-2" /> Próximamente
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
          <button disabled className="flex items-center justify-center px-4 py-3 bg-slate-100 border border-slate-200 text-slate-400 rounded-xl font-bold text-sm cursor-not-allowed">
            <Filter className="w-4 h-4 mr-2" /> Próximamente
          </button>
        </div>

        {/* Lista de Recibos */}
        <div className="space-y-3">
          {error ? (
            <div className="py-12">
              <EmptyState title="Error" description={error} />
            </div>
          ) : isLoading ? (
            <div className="py-12">
              <EmptyState title="Cargando..." description="Preparando la lista de recibos." />
            </div>
          ) : receipts.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {receipts.map((receipt) => (
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
                      {buildingById.get(receipt.buildingId)?.clientId ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                          {labelClient(buildingById.get(receipt.buildingId)!.clientId!)}
                        </span>
                      ) : null}
                      <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                        {buildingById.get(receipt.buildingId)?.name ?? receipt.buildingId}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                        Unidad {unitById.get(receipt.unitId)?.number ?? receipt.unitId}
                      </span>
                    </div>
                  }
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

