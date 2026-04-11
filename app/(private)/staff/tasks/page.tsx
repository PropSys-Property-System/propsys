'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ClipboardList, CheckCircle2, Circle, Link2, ListChecks, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { checklistExecutionsRepo, checklistTemplatesRepo, evidenceRepo, tasksRepo } from '@/lib/data';
import type { ChecklistExecution, ChecklistTemplate, EvidenceAttachment, TaskEntity } from '@/lib/types';

export default function StaffTasksPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allTasks, setAllTasks] = useState<TaskEntity[]>([]);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskEntity | null>(null);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [execution, setExecution] = useState<ChecklistExecution | null>(null);
  const [resultsByItemId, setResultsByItemId] = useState<Record<string, boolean>>({});
  const [evidence, setEvidence] = useState<EvidenceAttachment[]>([]);
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setError(null);
        const data = await tasksRepo.listForUser(user);
        if (!isMounted) return;
        setAllTasks(data);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar tus tareas.');
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

  const tasks = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return allTasks.filter((x) => x.title.toLowerCase().includes(t) || (x.description ?? '').toLowerCase().includes(t));
  }, [searchTerm, allTasks]);

  const openChecklist = async (task: TaskEntity) => {
    if (!user) return;
    setSelectedTask(task);
    setIsChecklistOpen(true);
    setActionError(null);
    setIsSubmitting(false);
    setEvidenceUrl('');
    setTemplates([]);
    setSelectedTemplateId('');
    setExecution(null);
    setResultsByItemId({});
    setEvidence([]);

    try {
      const allTemplates = await checklistTemplatesRepo.listForUser(user);
      const scoped = allTemplates.filter((t) => t.buildingId === task.buildingId);
      setTemplates(scoped);
      setSelectedTemplateId(scoped[0]?.id ?? '');

      const execs = await checklistExecutionsRepo.listForTask(user, task.id);
      const current = execs[0] ?? null;
      setExecution(current);
      if (current) {
        const initial: Record<string, boolean> = {};
        for (const r of current.results) initial[r.itemId] = Boolean(r.value);
        setResultsByItemId(initial);
        setSelectedTemplateId(current.templateId);
        const ev = await evidenceRepo.listForChecklistExecution(user, current.id);
        setEvidence(ev);
      }
    } catch {
      setActionError('No pudimos cargar el checklist de esta tarea.');
    }
  };

  const activeTemplate = useMemo(() => templates.find((t) => t.id === selectedTemplateId) ?? null, [templates, selectedTemplateId]);
  const isReadOnly = execution?.status === 'COMPLETED' || execution?.status === 'APPROVED';

  const ensureExecution = async () => {
    if (!user || !selectedTask) return null;
    if (execution) return execution;
    if (!selectedTemplateId) {
      setActionError('Selecciona un checklist.');
      return null;
    }
    try {
      setIsSubmitting(true);
      setActionError(null);
      const created = await checklistExecutionsRepo.createForTask(user, { taskId: selectedTask.id, templateId: selectedTemplateId });
      setExecution(created);
      setResultsByItemId({});
      setEvidence([]);
      return created;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos iniciar el checklist.');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const buildResults = () => {
    const tpl = activeTemplate;
    if (!tpl) return [];
    return tpl.items.map((it) => ({ itemId: it.id, value: Boolean(resultsByItemId[it.id]) }));
  };

  const saveChecklist = async () => {
    if (!user) return;
    const exec = await ensureExecution();
    if (!exec) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      const updated = await checklistExecutionsRepo.saveResultsForUser(user, exec.id, buildResults());
      if (updated) setExecution(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos guardar el checklist.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeChecklist = async () => {
    if (!user) return;
    const exec = await ensureExecution();
    if (!exec) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      const updated = await checklistExecutionsRepo.completeForUser(user, exec.id, buildResults());
      if (updated) setExecution(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos completar el checklist.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addEvidence = async () => {
    if (!user) return;
    const exec = await ensureExecution();
    if (!exec) return;
    const url = evidenceUrl.trim();
    if (!url) {
      setActionError('Ingresa un enlace.');
      return;
    }
    try {
      setIsSubmitting(true);
      setActionError(null);
      const created = await evidenceRepo.addForChecklistExecution(user, { checklistExecutionId: exec.id, url });
      setEvidenceUrl('');
      setEvidence((prev) => [created, ...prev]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos adjuntar la evidencia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Mis Tareas" description="Tareas operativas para tu turno en PropSys" />

      <div className="p-6 md:p-8 space-y-6">
        <div className="relative group max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar tareas..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
          />
        </div>

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando tareas..." />
        ) : tasks.length === 0 ? (
          <EmptyState title="Sin tareas" description={searchTerm ? `No hay resultados para "${searchTerm}".` : 'No hay tareas asignadas para este turno.'} />
        ) : (
          <div className="space-y-3 max-w-3xl">
            {tasks.map((task) => (
              <div key={task.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">{task.title}</p>
                  {task.description && <p className="mt-1 text-xs text-slate-500 font-medium">{task.description}</p>}
                  <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {task.status === 'APPROVED'
                      ? 'Aprobada'
                      : task.status === 'COMPLETED'
                        ? 'Completada'
                        : task.status === 'IN_PROGRESS'
                          ? 'En progreso'
                          : 'Pendiente'}
                  </p>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => openChecklist(task)}
                      className="inline-flex items-center px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all"
                    >
                      <ListChecks className="w-4 h-4 mr-2" /> Checklist & Evidencias
                    </button>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-primary/10">
                  {task.status === 'COMPLETED' || task.status === 'APPROVED' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <Circle className="w-6 h-6 text-primary" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center py-4">
          <div className="flex items-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
            <ClipboardList className="w-4 h-4 mr-2" /> PropSys Staff
          </div>
        </div>
      </div>

      {isChecklistOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsChecklistOpen(false)}
            type="button"
          />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-lg font-black text-slate-900 truncate">Checklist</p>
                <p className="mt-1 text-xs text-slate-500 font-medium truncate">{selectedTask.title}</p>
                <p className="mt-3 text-[11px] text-slate-400 font-semibold">
                  Evidencias en V1: enlaces (sin subida de archivos).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsChecklistOpen(false)}
                className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700"
              >
                Cerrar
              </button>
            </div>

            {actionError && <div className="mt-4"><ErrorState title="Acción no disponible" description={actionError} /></div>}

            <div className="mt-5 space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Checklist</label>
                {templates.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 font-semibold">
                    No hay checklist configurado para este edificio.
                  </div>
                ) : (
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    disabled={Boolean(execution)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium disabled:opacity-70"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {activeTemplate && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Items</p>
                    {execution && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {execution.status === 'APPROVED' ? 'Aprobado' : execution.status === 'COMPLETED' ? 'Completado' : 'Pendiente'}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {activeTemplate.items.map((it) => (
                      <label
                        key={it.id}
                        className={`flex items-start gap-3 rounded-2xl border border-slate-200 p-4 ${isReadOnly ? 'bg-slate-50' : 'bg-white'}`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(resultsByItemId[it.id])}
                          disabled={isReadOnly}
                          onChange={(e) => setResultsByItemId((prev) => ({ ...prev, [it.id]: e.target.checked }))}
                          className="mt-1 h-4 w-4"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-black text-slate-900">{it.label}</span>
                          <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {it.required ? 'Requerido' : 'Opcional'}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                    <button
                      type="button"
                      disabled={isSubmitting || templates.length === 0 || isReadOnly}
                      onClick={saveChecklist}
                      className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all disabled:opacity-70"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting || templates.length === 0 || isReadOnly}
                      onClick={completeChecklist}
                      className="px-5 py-3 rounded-xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-70"
                    >
                      Completar
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Evidencias</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    placeholder="Pega un enlace (https://...)"
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                    disabled={isReadOnly}
                  />
                  <button
                    type="button"
                    onClick={addEvidence}
                    disabled={isSubmitting || isReadOnly}
                    className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all disabled:opacity-70"
                  >
                    <Link2 className="w-4 h-4 inline-block mr-2" />
                    Adjuntar
                  </button>
                </div>

                {evidence.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 font-semibold">
                    Sin evidencias adjuntas.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {evidence.map((ev) => (
                      <a
                        key={ev.id}
                        href={ev.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50 transition-all"
                      >
                        <p className="text-sm font-black text-slate-900 truncate">{ev.fileName}</p>
                        <p className="mt-1 text-xs text-slate-500 font-medium truncate">{ev.url}</p>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


