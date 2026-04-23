'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Filter, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import {
  createTicketForUser,
  loadAdminTicketsPageData,
  listTicketsForUser,
  updateTicketStatusForUser,
} from '@/lib/features/tickets/ticket-center.data';
import { AdminTicketCard, TicketComposerDialog } from '@/lib/features/tickets/ticket-center.ui';
import { formatClientBadge } from '@/lib/presentation/labels';
import type { IncidentEntity } from '@/lib/types';

export default function AdminTicketsPage() {
  const { user } = useAuth();
  const [allTickets, setAllTickets] = useState<IncidentEntity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [buildingFilterId, setBuildingFilterId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusById, setStatusById] = useState<Record<string, IncidentEntity['status']>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createBuildingId, setCreateBuildingId] = useState('');
  const [createUnitId, setCreateUnitId] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPriority, setCreatePriority] = useState<IncidentEntity['priority']>('MEDIUM');
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; buildingId: string; number: string }[]>([]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        setActionError(null);
        const data = await loadAdminTicketsPageData(user);
        if (!isMounted) return;
        setAllTickets(data.tickets);
        setBuildings(data.buildings);
        setUnits(data.units);
        setCreateBuildingId((prev) => prev || data.defaultCreateBuildingId);
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
    return allTickets.filter((ticket) => {
      if (buildingFilterId && ticket.buildingId !== buildingFilterId) return false;
      return (
        ticket.title.toLowerCase().includes(normalizedTerm) ||
        ticket.description.toLowerCase().includes(normalizedTerm)
      );
    });
  }, [allTickets, buildingFilterId, searchTerm]);

  const buildingNameById = useMemo(
    () => new Map(buildings.map((building) => [building.id, building.name])),
    [buildings]
  );
  const unitNumberById = useMemo(() => new Map(units.map((unit) => [unit.id, unit.number])), [units]);

  const canCreate = user?.internalRole === 'BUILDING_ADMIN';
  const canUpdate = user?.internalRole === 'BUILDING_ADMIN';
  const allStatuses: IncidentEntity['status'][] = ['REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

  const submitCreate = async () => {
    if (!user) return;

    if (!createBuildingId) {
      setActionError('Selecciona un edificio.');
      return;
    }

    if (!createTitle.trim() || !createDescription.trim()) {
      setActionError('Completa titulo y descripcion.');
      return;
    }

    const unit = createUnitId ? units.find((currentUnit) => currentUnit.id === createUnitId) : undefined;
    if (unit && unit.buildingId !== createBuildingId) {
      setActionError('La unidad seleccionada no pertenece al edificio.');
      return;
    }

    try {
      setIsSubmitting(true);
      setActionError(null);
      await createTicketForUser(user, {
        buildingId: createBuildingId,
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

  const closeIncident = async (id: string) => {
    if (!user) return;

    try {
      setIsSubmitting(true);
      setActionError(null);
      await updateTicketStatusForUser(user, id, 'CLOSED');
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos cerrar la incidencia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const actions = (
    <>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Proximamente"
        className="flex items-center px-4 py-2 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl font-bold text-sm cursor-not-allowed"
      >
        <Filter className="w-4 h-4 mr-2" /> Proximamente
      </button>
      {canCreate && (
        <button
          onClick={() => {
            setActionError(null);
            setIsCreateOpen(true);
          }}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
        >
          <Plus className="w-4 h-4 mr-2" /> Nueva incidencia
        </button>
      )}
    </>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Incidencias" description="Gestiona solicitudes de mantenimiento y reportes operativos" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        {formatClientBadge(user) && (
          <div className="max-w-2xl">
            <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
              {formatClientBadge(user)}
            </span>
          </div>
        )}

        {actionError && <ErrorState title="Accion no disponible" description={actionError} />}

        <div className="flex flex-col md:flex-row gap-4 max-w-4xl">
          <div className="relative group flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por titulo o descripcion..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            />
          </div>
          <select
            value={buildingFilterId}
            onChange={(event) => setBuildingFilterId(event.target.value)}
            className="w-full md:w-72 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-bold"
          >
            <option value="">Todos los edificios</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
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
              <AdminTicketCard
                key={ticket.id}
                ticket={ticket}
                buildingName={buildingNameById.get(ticket.buildingId) ?? ticket.buildingId}
                unitLabel={ticket.unitId ? (unitNumberById.get(ticket.unitId) ?? ticket.unitId) : null}
                canUpdate={Boolean(canUpdate)}
                isSubmitting={isSubmitting}
                selectedStatus={statusById[ticket.id] ?? ''}
                allStatuses={allStatuses}
                onStatusChange={(status) => setStatusById((prev) => ({ ...prev, [ticket.id]: status }))}
                onSaveStatus={() => updateStatus(ticket.id)}
                onCloseIncident={() => closeIncident(ticket.id)}
              />
            ))}
          </div>
        )}
      </div>

      <TicketComposerDialog
        isOpen={isCreateOpen}
        isSubmitting={isSubmitting}
        buildings={buildings}
        units={units}
        buildingId={createBuildingId}
        unitId={createUnitId}
        title={createTitle}
        description={createDescription}
        priority={createPriority}
        onClose={() => setIsCreateOpen(false)}
        onBuildingChange={(buildingId) => {
          setCreateBuildingId(buildingId);
          setCreateUnitId('');
        }}
        onUnitChange={setCreateUnitId}
        onTitleChange={setCreateTitle}
        onDescriptionChange={setCreateDescription}
        onPriorityChange={setCreatePriority}
        onSubmit={submitCreate}
      />
    </div>
  );
}
