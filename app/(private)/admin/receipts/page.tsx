'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Download, Filter, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import { loadAdminReceiptsPageData } from '@/lib/features/receipts/receipts-center.data';
import { AdminReceiptsList } from '@/lib/features/receipts/receipts-center.ui';
import type { Receipt } from '@/lib/types';

export default function AdminReceiptsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allReceipts, setAllReceipts] = useState<Receipt[]>([]);
  const [buildings, setBuildings] = useState<{ id: string; name: string; clientId?: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; buildingId: string; number: string }[]>([]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await loadAdminReceiptsPageData(user);
        if (!isMounted) return;
        setAllReceipts(data.receipts);
        setBuildings(data.buildings);
        setUnits(data.units);
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
    const normalizedTerm = searchTerm.toLowerCase();
    return allReceipts.filter(
      (receipt) =>
        receipt.number.toLowerCase().includes(normalizedTerm) ||
        receipt.description.toLowerCase().includes(normalizedTerm)
    );
  }, [allReceipts, searchTerm]);

  const buildingById = useMemo(() => new Map(buildings.map((building) => [building.id, building])), [buildings]);
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);

  const actions = (
    <>
      <button disabled className="flex items-center px-4 py-2 bg-slate-100 text-slate-400 rounded-xl font-bold text-sm cursor-not-allowed">
        <Download className="w-4 h-4 mr-2" /> Proximamente
      </button>
      <button disabled className="flex items-center px-4 py-2 bg-slate-100 text-slate-400 rounded-xl font-bold text-sm cursor-not-allowed">
        <Plus className="w-4 h-4 mr-2" /> Proximamente
      </button>
    </>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Gestion de Recibos" description="Administra, emite y controla los pagos de la comunidad" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Buscar por numero o descripcion..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <button disabled className="flex items-center justify-center px-4 py-3 bg-slate-100 border border-slate-200 text-slate-400 rounded-xl font-bold text-sm cursor-not-allowed">
            <Filter className="w-4 h-4 mr-2" /> Proximamente
          </button>
        </div>

        <div className="space-y-3">
          {error ? (
            <div className="py-12">
              <ErrorState title="Error" description={error} />
            </div>
          ) : isLoading ? (
            <div className="py-12">
              <LoadingState title="Cargando recibos..." />
            </div>
          ) : receipts.length > 0 ? (
            <AdminReceiptsList
              receipts={receipts}
              buildingById={buildingById}
              unitById={unitById}
              onView={(receiptId) => router.push(`/admin/receipts/${receiptId}`)}
            />
          ) : (
            <div className="py-12">
              <EmptyState
                title="No se encontraron recibos"
                description={searchTerm ? `No hay resultados para "${searchTerm}"` : 'Aun no se han emitido recibos en el sistema.'}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
