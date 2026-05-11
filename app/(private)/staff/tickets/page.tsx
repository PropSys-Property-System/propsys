'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import {
  createTicketForUser,
  listTicketsForUser,
  loadStaffTicketsPageData,
  updateTicketStatusForUser,
} from '@/lib/features/tickets/ticket-center.data';
import { StaffTicketCard, StaffTicketComposerDialog } from '@/lib/features/tickets/ticket-center.ui';
import type { IncidentEntity } from '@/lib/types';

export default function StaffTicketsPage() {
  const { user } = useAuth();
  const [allTickets, setAllTickets] = useState<IncidentEntity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPriority, setCreatePriority] = useState<IncidentEntity['priority']>('MEDIUM');
  const [units, setUnits] = useState<{ id: string; buildingId: string; number: string }[]>([]);
  const [createUnitId, setCreateUnitId] = useState('');
  const [statusById, setStatusById] = useState<Record<string, IncidentEntity['status']>>({});

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        setActionError(null);
        const data = await loadStaffTicketsPageData(user);
        if (!isMounted) return;
        setAllTickets(data.tickets);
        setUnits(data.units);
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

  const reload = async () => {
    if (!user) return;
    setActionError(null);
    const data = await listTicketsForUser(user);
    setAllTickets(data);
  };

  const tickets = useMemo(() => {
    const normalizedTerm = searchTerm.toLowerCase();
    return allTickets.filter(
      (ticket) =>
        ticket.title.toLowerCase().includes(normalizedTerm) ||
        ticket.description.toLowerCase().includes(normalizedTerm),
    );
  }, [allTickets, searchTerm]);

  const canCreate = user?.internalRole === 'STAFF';
  const allowedStaffStatuses: IncidentEntity['status'][] = ['IN_PROGRESS', 'RESOLVED'];

  const submitCreate = async () => {
    if (!user) return;

    if (!createTitle.trim() || !createDescription.trim()) {
      setActionError('Completa titulo y descripcion.');
      return;
    }

    const selectedUnit = createUnitId ? units.find((unit) => unit.id === createUnitId) : undefined;
    const buildingId = selectedUnit?.buildingId ?? user.buildingId ?? '';
    if (!buildingId) {
      setActionError('No hay edificio asociado para crear la incidencia.');
      return;
    }

    try {
      setIsSubmitting(true);
      setActionError(null);
      await createTicketForUser(user, {
        buildingId,
        unitId: createUnitId || undefined,
        title: createTitle.trim(),
        description: createDescription.trim(),
        priority: createPriority,
      });
      setIsCreateOpen(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreatePriority('MEDIUM');
      setCreateUnitId('');
      await reload();
    } catch {
      setActionError('No pudimos crear la incidencia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string) => {
    if (!user) return;
    const nextStatus = statusById[id];
    if (!nextStatus) return;

    try {
      setIsSubmitting(true);
      setActionError(null);
      await updateTicketStatusForUser(user, id, nextStatus);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos actualizar la incidencia.');
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
      className="flex items-center px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
    >
      <Plus className="w-4 h-4 mr-2" /> Reportar
    </button>
  ) : null;

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Incidencias" description="Reporta y sigue incidencias operativas del edificio" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        {actionError ? <ErrorState title="Accion no disponible" description={actionError} /> : null}

        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs font-black text-slate-700 uppercase tracking-[0.2em]">Flujo operativo</p>
          <p className="mt-2 text-sm text-slate-600 font-medium">
            El personal puede reportar incidencias y marcarlas como resueltas. Administracion revisa el trabajo y realiza el cierre final.
          </p>
        </div>

        <div className="relative group max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar incidencias..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
          />
        </div>

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando incidencias..." />
        ) : tickets.length === 0 ? (
          <EmptyState title="Sin incidencias" description={searchTerm ? `No hay resultados para "${searchTerm}".` : 'Aun no hay incidencias registradas.'} />
        ) : (
          <div className="space-y-3 max-w-4xl">
            {tickets.map((ticket) => (
              <StaffTicketCard
                key={ticket.id}
                ticket={ticket}
                isSubmitting={isSubmitting}
                selectedStatus={statusById[ticket.id] ?? ''}
                allowedStatuses={allowedStaffStatuses}
                onStatusChange={(status) => setStatusById((prev) => ({ ...prev, [ticket.id]: status }))}
                onSaveStatus={() => updateStatus(ticket.id)}
              />
            ))}
          </div>
        )}
      </div>

      <StaffTicketComposerDialog
        isOpen={isCreateOpen}
        isSubmitting={isSubmitting}
        units={units}
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
