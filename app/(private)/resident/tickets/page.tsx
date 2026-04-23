'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import { createTicketForUser, listTicketsForUser, loadResidentTicketsPageData } from '@/lib/features/tickets/ticket-center.data';
import { ResidentTicketCard, ResidentTicketComposerDialog } from '@/lib/features/tickets/ticket-center.ui';
import { IncidentEntity } from '@/lib/types';
import { formatClientBadge } from '@/lib/presentation/labels';

export default function ResidentTicketsPage() {
  const { user } = useAuth();
  const [allTickets, setAllTickets] = useState<IncidentEntity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createUnitId, setCreateUnitId] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPriority, setCreatePriority] = useState<IncidentEntity['priority']>('MEDIUM');
  const [units, setUnits] = useState<{ id: string; buildingId: string; number: string }[]>([]);
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setError(null);
        setActionError(null);
        const data = await loadResidentTicketsPageData(user);
        if (!isMounted) return;
        setAllTickets(data.tickets);
        setUnits(data.units);
        setBuildings(data.buildings);
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

  const reload = async () => {
    if (!user) return;
    setActionError(null);
    const data = await listTicketsForUser(user);
    setAllTickets(data);
  };

  const tickets = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return allTickets.filter((x) => x.title.toLowerCase().includes(t) || x.description.toLowerCase().includes(t));
  }, [allTickets, searchTerm]);
  const buildingNameById = useMemo(() => new Map(buildings.map((building) => [building.id, building.name])), [buildings]);

  const canCreate = user?.internalRole === 'OWNER';

  const submitCreate = async () => {
    if (!user) return;
    if (!createUnitId) {
      setActionError('Selecciona una unidad.');
      return;
    }
    if (!createTitle.trim() || !createDescription.trim()) {
      setActionError('Completa título y descripción.');
      return;
    }
    const unit = units.find((u) => u.id === createUnitId);
    if (!unit) {
      setActionError('Unidad inválida.');
      return;
    }
    try {
      setIsSubmitting(true);
      setActionError(null);
      await createTicketForUser(user, {
        buildingId: unit.buildingId,
        unitId: unit.id,
        title: createTitle.trim(),
        description: createDescription.trim(),
        priority: createPriority,
      });
      setIsCreateOpen(false);
      setCreateUnitId('');
      setCreateTitle('');
      setCreateDescription('');
      setCreatePriority('MEDIUM');
      await reload();
    } catch {
      setActionError('No pudimos crear la incidencia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const actions = canCreate ? (
    <button
      onClick={() => {
        setActionError(null);
        setIsCreateOpen(true);
      }}
      className="flex items-center px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95"
    >
      <Plus className="w-5 h-5 mr-3" /> Reportar Incidencia
    </button>
  ) : null;

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Incidencias" description="Reporta problemas de tu unidad o del edificio" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        {formatClientBadge(user) && (
          <div className="max-w-2xl">
            <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
              {formatClientBadge(user)}
            </span>
          </div>
        )}

        {actionError && <ErrorState title="Acción no disponible" description={actionError} />}

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
              <ResidentTicketCard key={t.id} ticket={t} />
            ))}
          </div>
        )}
      </div>

      <ResidentTicketComposerDialog
        isOpen={isCreateOpen}
        isSubmitting={isSubmitting}
        units={units}
        buildingNameById={buildingNameById}
        unitId={createUnitId}
        title={createTitle}
        description={createDescription}
        priority={createPriority}
        onClose={() => setIsCreateOpen(false)}
        onUnitChange={setCreateUnitId}
        onTitleChange={setCreateTitle}
        onDescriptionChange={setCreateDescription}
        onPriorityChange={setCreatePriority}
        onSubmit={submitCreate}
      />
    </div>
  );
}


