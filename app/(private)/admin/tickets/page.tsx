'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Filter, Plus, Search, Wrench } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { buildingsRepo, incidentsRepo, unitsRepo } from '@/lib/data';
import { IncidentEntity } from '@/lib/types';
import { formatClientBadge, labelIncidentPriority, labelIncidentStatus } from '@/lib/presentation/labels';

function statusChip(status: IncidentEntity['status']) {
  const base = 'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest';
  if (status === 'REPORTED') return `${base} bg-rose-50 text-rose-700`;
  if (status === 'ASSIGNED') return `${base} bg-amber-50 text-amber-700`;
  if (status === 'IN_PROGRESS') return `${base} bg-amber-50 text-amber-700`;
  if (status === 'RESOLVED') return `${base} bg-emerald-50 text-emerald-700`;
  return `${base} bg-slate-100 text-slate-600`;
}

function priorityChip(priority: IncidentEntity['priority']) {
  const base = 'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest';
  if (priority === 'HIGH') return `${base} bg-rose-50 text-rose-700`;
  if (priority === 'MEDIUM') return `${base} bg-amber-50 text-amber-700`;
  return `${base} bg-slate-100 text-slate-600`;
}

export default function AdminTicketsPage() {
  const { user } = useAuth();
  const [allTickets, setAllTickets] = useState<IncidentEntity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
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
        const data = await incidentsRepo.listForUser(user);
        const b = await buildingsRepo.listForUser(user);
        const u = await unitsRepo.listForUser(user);
        if (!isMounted) return;
        setAllTickets(data);
        setBuildings(b.map((x) => ({ id: x.id, name: x.name })));
        setUnits(u.map((x) => ({ id: x.id, buildingId: x.buildingId, number: x.number })));
        setCreateBuildingId((prev) => prev || user.buildingId || b[0]?.id || '');
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
    const data = await incidentsRepo.listForUser(user);
    setAllTickets(data);
  };

  const tickets = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return allTickets.filter((x) => x.title.toLowerCase().includes(t) || x.description.toLowerCase().includes(t));
  }, [allTickets, searchTerm]);

  const canCreate = user?.internalRole === 'BUILDING_ADMIN';
  const canUpdate = user?.internalRole === 'BUILDING_ADMIN';

  const submitCreate = async () => {
    if (!user) return;
    if (!createBuildingId) {
      setActionError('Selecciona un edificio.');
      return;
    }
    if (!createTitle.trim() || !createDescription.trim()) {
      setActionError('Completa título y descripción.');
      return;
    }
    const unit = createUnitId ? units.find((u) => u.id === createUnitId) : undefined;
    if (unit && unit.buildingId !== createBuildingId) {
      setActionError('La unidad seleccionada no pertenece al edificio.');
      return;
    }
    try {
      setIsSubmitting(true);
      setActionError(null);
      await incidentsRepo.createSimpleForUser(user, {
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

  const allStatuses: IncidentEntity['status'][] = ['REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

  const updateStatus = async (id: string) => {
    if (!user) return;
    const next = statusById[id];
    if (!next) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      await incidentsRepo.updateStatusForUser(user, id, next);
      await reload();
    } catch {
      setActionError('No pudimos actualizar la incidencia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeIncident = async (id: string) => {
    if (!user) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      await incidentsRepo.updateStatusForUser(user, id, 'CLOSED');
      await reload();
    } catch {
      setActionError('No pudimos cerrar la incidencia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const actions = (
    <>
      <button className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">
        <Filter className="w-4 h-4 mr-2" /> Filtros
      </button>
      {canCreate && (
        <button
          onClick={() => {
            setActionError(null);
            setIsCreateOpen(true);
          }}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
        >
          <Plus className="w-4 h-4 mr-2" /> Nueva Incidencia
        </button>
      )}
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
                    <span className={statusChip(t.status)}>{labelIncidentStatus(t.status)}</span>
                    <span className={priorityChip(t.priority)}>{labelIncidentPriority(t.priority)}</span>
                  </div>
                  <p className="mt-3 text-sm font-black text-slate-900 truncate">{t.title}</p>
                  <p className="mt-1 text-xs text-slate-500 font-medium line-clamp-2">{t.description}</p>
                  <p className="mt-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Creado {new Date(t.createdAt).toLocaleString('es-CL')}
                  </p>
                  {canUpdate && (
                    <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
                      <select
                        value={statusById[t.id] ?? ''}
                        onChange={(e) => setStatusById((prev) => ({ ...prev, [t.id]: e.target.value as IncidentEntity['status'] }))}
                        className="w-full sm:w-56 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-xs font-bold"
                      >
                        <option value="" disabled>
                          Cambiar estado...
                        </option>
                        {allStatuses.map((s) => (
                          <option key={s} value={s}>
                            {labelIncidentStatus(s)}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={!statusById[t.id] || isSubmitting}
                        onClick={() => updateStatus(t.id)}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all disabled:opacity-60"
                      >
                        Guardar
                      </button>
                      <button
                        disabled={isSubmitting || t.status === 'CLOSED'}
                        onClick={() => closeIncident(t.id)}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all disabled:opacity-60"
                      >
                        Cerrar
                      </button>
                    </div>
                  )}
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-6 h-6 text-primary" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="Cerrar" className="absolute inset-0 bg-black/30" onClick={() => setIsCreateOpen(false)} type="button" />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-black text-slate-900">Nueva incidencia</p>
                <p className="mt-1 text-xs text-slate-500 font-medium">Crea una incidencia para el edificio.</p>
              </div>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700">
                Cerrar
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Edificio</label>
                <select
                  value={createBuildingId}
                  onChange={(e) => {
                    setCreateBuildingId(e.target.value);
                    setCreateUnitId('');
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                >
                  <option value="" disabled>
                    Selecciona...
                  </option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Unidad (opcional)</label>
                <select
                  value={createUnitId}
                  onChange={(e) => setCreateUnitId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                >
                  <option value="">Sin unidad</option>
                  {units
                    .filter((u) => u.buildingId === createBuildingId)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.number}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Prioridad</label>
                <select
                  value={createPriority}
                  onChange={(e) => setCreatePriority(e.target.value as IncidentEntity['priority'])}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                >
                  <option value="LOW">{labelIncidentPriority('LOW')}</option>
                  <option value="MEDIUM">{labelIncidentPriority('MEDIUM')}</option>
                  <option value="HIGH">{labelIncidentPriority('HIGH')}</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Título</label>
                <input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Descripción</label>
                <textarea
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium min-h-[120px]"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={submitCreate}
                className="px-5 py-3 rounded-xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-70"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

