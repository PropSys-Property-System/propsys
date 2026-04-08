'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Filter, Plus, Search, Wrench } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { ticketsRepo } from '@/lib/data';
import { Ticket } from '@/lib/types';

function statusChip(status: Ticket['status']) {
  const base = 'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest';
  if (status === 'OPEN') return `${base} bg-rose-50 text-rose-700`;
  if (status === 'IN_PROGRESS') return `${base} bg-amber-50 text-amber-700`;
  if (status === 'RESOLVED') return `${base} bg-emerald-50 text-emerald-700`;
  return `${base} bg-slate-100 text-slate-600`;
}

function priorityChip(priority: Ticket['priority']) {
  const base = 'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest';
  if (priority === 'HIGH') return `${base} bg-rose-50 text-rose-700`;
  if (priority === 'MEDIUM') return `${base} bg-amber-50 text-amber-700`;
  return `${base} bg-slate-100 text-slate-600`;
}

export default function AdminTicketsPage() {
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
        setError('No pudimos cargar las incidencias.');
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
    <>
      <button className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">
        <Filter className="w-4 h-4 mr-2" /> Filtros
      </button>
      <button className="flex items-center px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
        <Plus className="w-4 h-4 mr-2" /> Nueva Incidencia
      </button>
    </>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader
        title="Incidencias"
        description="Gestiona solicitudes de mantenimiento y reportes operativos"
        actions={actions}
      />

      <div className="p-6 md:p-8 space-y-6">
        <div className="relative group max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por título o descripción..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
          />
        </div>

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando incidencias..." />
        ) : tickets.length === 0 ? (
          <EmptyState title="Sin incidencias" description={searchTerm ? `No hay resultados para "${searchTerm}".` : 'Aún no hay incidencias registradas.'} />
        ) : (
          <div className="space-y-3 max-w-4xl">
            {tickets.map((t) => (
              <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={statusChip(t.status)}>{t.status}</span>
                    <span className={priorityChip(t.priority)}>{t.priority}</span>
                  </div>
                  <p className="mt-3 text-sm font-black text-slate-900 truncate">{t.title}</p>
                  <p className="mt-1 text-xs text-slate-500 font-medium line-clamp-2">{t.description}</p>
                  <p className="mt-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Creado {new Date(t.createdAt).toLocaleString('es-CL')}
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

