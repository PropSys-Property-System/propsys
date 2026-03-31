'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Plus, Search, Wrench } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { ticketsRepo } from '@/lib/data';
import { Ticket } from '@/lib/types';

function statusChip(status: Ticket['status']) {
  const base = 'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest';
  if (status === 'OPEN') return `${base} bg-amber-50 text-amber-700`;
  if (status === 'IN_PROGRESS') return `${base} bg-primary/10 text-primary`;
  if (status === 'RESOLVED') return `${base} bg-emerald-50 text-emerald-700`;
  return `${base} bg-slate-100 text-slate-600`;
}

export default function ResidentTicketsPage() {
  const { user } = useAuth();
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setError(null);
        const data = await ticketsRepo.listForUser(user);
        if (!isMounted) return;
        setAllTickets(data);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar tus incidencias.');
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

  const tickets = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return allTickets.filter((x) => x.title.toLowerCase().includes(t) || x.description.toLowerCase().includes(t));
  }, [allTickets, searchTerm]);

  const actions = (
    <button className="flex items-center px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95">
      <Plus className="w-5 h-5 mr-3" /> Reportar Incidencia
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Incidencias" description="Reporta problemas de tu unidad o del edificio" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        <div className="relative group max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar incidencias..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
          />
        </div>

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando incidencias..." />
        ) : tickets.length === 0 ? (
          <EmptyState title="Sin incidencias" description={searchTerm ? `No hay resultados para "${searchTerm}".` : 'Aún no has reportado incidencias.'} />
        ) : (
          <div className="space-y-3 max-w-4xl">
            {tickets.map((t) => (
              <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={statusChip(t.status)}>{t.status}</span>
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                      {t.priority}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-black text-slate-900">{t.title}</p>
                  <p className="mt-2 text-xs text-slate-500 font-medium">{t.description}</p>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {new Date(t.createdAt).toLocaleString('es-CL')}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-6 h-6 text-primary" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

