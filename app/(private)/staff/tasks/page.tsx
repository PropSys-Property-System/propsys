'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ClipboardList, CheckCircle2, Circle, ExternalLink, FileText, Link2, ListChecks, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { checklistExecutionsRepo, checklistTemplatesRepo, evidenceRepo, tasksRepo } from '@/lib/data';
import type { ChecklistExecution, ChecklistTemplate, EvidenceAttachment, TaskEntity } from '@/lib/types';

export default function StaffTasksPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allTasks, setAllTasks] = useState<TaskEntity[]>([]);
  const [statusById, setStatusById] = useState<Record<string, TaskEntity['status']>>({});
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskEntity | null>(null);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [execution, setExecution] = useState<ChecklistExecution | null>(null);
  const [resultsByItemId, setResultsByItemId] = useState<Record<string, boolean>>({});
  const [evidence, setEvidence] = useState<EvidenceAttachment[]>([]);
  const [evidenceUrlInput, setEvidenceUrlInput] = useState('');
  const [evidenceLabelInput, setEvidenceLabelInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const imageLoader = ({ src }: { src: string }) => src;

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

  const reload = async () => {
    if (!user) return;
    const data = await tasksRepo.listForUser(user);
    setAllTasks(data);
  };

  const updateStatus = async (id: string) => {
    if (!user) return;
    const next = statusById[id];
    if (!next) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      await tasksRepo.updateStatusForUser(user, id, next);
      await reload();
      setStatusById((prev) => {
        const nextState = { ...prev };
        delete nextState[id];
        return nextState;
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos actualizar la tarea.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const allowedNextStatuses = (task: TaskEntity): TaskEntity['status'][] => {
    if (task.status === 'PENDING') return ['IN_PROGRESS'];
    if (task.status === 'IN_PROGRESS' && !task.checklistTemplateId) return ['COMPLETED'];
    return [];
  };

  const openChecklist = async (task: TaskEntity) => {
    if (!user) return;
    if (!task.checklistTemplateId) {
      setActionError('Esta tarea no tiene checklist asignado.');
      return;
    }
    setSelectedTask(task);
    setIsChecklistOpen(true);
    setActionError(null);
    setIsSubmitting(false);
    setEvidenceUrlInput('');
    setEvidenceLabelInput('');
    setTemplates([]);
    setSelectedTemplateId('');
    setExecution(null);
    setResultsByItemId({});
    setEvidence([]);

    try {
      const tpl = await checklistTemplatesRepo.getByIdForUser(user, task.checklistTemplateId);
      if (!tpl) {
        setActionError('El checklist asignado ya no está disponible.');
        return;
      }
      setTemplates([tpl]);
      setSelectedTemplateId(tpl.id);

      const execs = await checklistExecutionsRepo.listForTask(user, task.id);
      const current = execs[0] ?? null;
      setExecution(current);
      if (current) {
        const initial: Record<string, boolean> = {};
        for (const r of current.results) initial[r.itemId] = Boolean(r.value);
        setResultsByItemId(initial);
        try {
          const ev = await evidenceRepo.listForChecklistExecution(user, current.id);
          setEvidence(ev);
        } catch {
          setActionError('No pudimos cargar las evidencias de esta tarea.');
        }
      }
    } catch {
      setActionError('No pudimos cargar el estado del checklist de esta tarea.');
    }
  };

  const activeTemplate = useMemo(() => templates.find((t) => t.id === selectedTemplateId) ?? null, [templates, selectedTemplateId]);
  const isItemsReadOnly = execution?.status === 'COMPLETED' || execution?.status === 'APPROVED';
  const isEvidenceLocked = execution?.status === 'APPROVED';
  const isChecklistCompletable = useMemo(() => {
    if (!activeTemplate) return false;
    const requiredItems = activeTemplate.items.filter((it) => it.required);
    if (requiredItems.length === 0) return true;
    return requiredItems.every((it) => Boolean(resultsByItemId[it.id]));
  }, [activeTemplate, resultsByItemId]);

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
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos completar el checklist.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* Legacy upload flow removed. V1 accepts URL evidence only.
  const isAllowedEvidence = (file: File) => {
    const name = file.name.toLowerCase();
    const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf';
    const isImageExt = name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp');
    const isImageMime = file.type.startsWith('image/');
    if (!(isPdf || isImageExt)) return false;
    if (file.type && !(file.type === 'application/pdf' || file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp' || isImageMime)) {
      return false;
    }
    return true;
  };

  const uploadEvidence = async () => {
    if (!user) return;
    const exec = await ensureExecution();
    if (!exec) return;
    if (exec.status === 'APPROVED') {
      setActionError('No puedes adjuntar evidencias a un checklist aprobado.');
      return;
    }
    if (!evidenceFile) {
      setActionError('Selecciona un archivo.');
      return;
    }
    if (evidenceFile.size > 10 * 1024 * 1024) {
      setActionError('El archivo supera el límite de 10 MB.');
      return;
    }
    if (!isAllowedEvidence(evidenceFile)) {
      setActionError('Tipo de archivo no permitido. Solo imágenes (jpg/jpeg/png/webp) o PDF.');
      return;
    }
    try {
      setIsSubmitting(true);
      setActionError(null);
      const created = await evidenceRepo.uploadForChecklistExecution(user, { checklistExecutionId: exec.id, file: evidenceFile });
      setEvidenceFile(null);
      setEvidence((prev) => [created, ...prev]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos adjuntar la evidencia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  */

  const addEvidenceLink = async () => {
    if (!user) return;
    const exec = await ensureExecution();
    if (!exec) return;
    if (exec.status === 'APPROVED') {
      setActionError('No puedes adjuntar evidencias a un checklist aprobado.');
      return;
    }

    const trimmedUrl = evidenceUrlInput.trim();
    const trimmedLabel = evidenceLabelInput.trim();
    if (!trimmedUrl) {
      setActionError('Ingresa una URL para la evidencia.');
      return;
    }

    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('invalid-protocol');
      }
    } catch {
      setActionError('Ingresa una URL valida para la evidencia.');
      return;
    }

    try {
      setIsSubmitting(true);
      setActionError(null);
      const created = await evidenceRepo.addForChecklistExecution(user, {
        checklistExecutionId: exec.id,
        url: trimmedUrl,
        fileName: trimmedLabel || undefined,
      });
      setEvidenceUrlInput('');
      setEvidenceLabelInput('');
      setEvidence((prev) => [created, ...prev]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos registrar la evidencia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteEvidence = async (ev: EvidenceAttachment) => {
    if (!user) return;
    if (isEvidenceLocked) {
      setActionError('No puedes eliminar evidencias de un checklist aprobado.');
      return;
    }
    const okConfirm = window.confirm(`¿Eliminar evidencia "${ev.fileName}"?`);
    if (!okConfirm) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      await evidenceRepo.deleteForUser(user, ev.id);
      setEvidence((prev) => prev.filter((x) => x.id !== ev.id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos eliminar la evidencia.');
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
                  {(() => {
                    const nextStatuses = allowedNextStatuses(task);
                    if (task.status === 'COMPLETED' || task.status === 'APPROVED') return null;
                    if (nextStatuses.length === 0) return null;
                    return (
                    <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
                      <select
                        value={statusById[task.id] ?? ''}
                        onChange={(e) => setStatusById((prev) => ({ ...prev, [task.id]: e.target.value as TaskEntity['status'] }))}
                        className="w-full sm:w-56 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-xs font-bold"
                      >
                        <option value="" disabled>
                          Cambiar estado...
                        </option>
                        {nextStatuses.map((s) => (
                          <option key={s} value={s}>
                            {s === 'IN_PROGRESS' ? 'En progreso' : 'Completada'}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={!statusById[task.id] || isSubmitting}
                        onClick={() => updateStatus(task.id)}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all disabled:opacity-60"
                      >
                        Guardar
                      </button>
                    </div>
                    );
                  })()}
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => openChecklist(task)}
                      disabled={!task.checklistTemplateId}
                      className="inline-flex items-center px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all"
                    >
                      <ListChecks className="w-4 h-4 mr-2" /> Checklist & Evidencias
                    </button>
                    {!task.checklistTemplateId && (
                      <p className="mt-2 text-[11px] text-slate-400 font-semibold">Esta tarea no tiene checklist asignado.</p>
                    )}
                    {task.checklistTemplateId && task.status === 'IN_PROGRESS' && (
                      <p className="mt-2 text-[11px] text-slate-400 font-semibold">Completa el checklist para finalizar la tarea.</p>
                    )}
                  </div>
                  {!activeTemplate && (
                    <p className="text-[11px] text-slate-400 font-semibold">Primero debemos cargar el checklist para habilitar las evidencias.</p>
                  )}
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
          <div
            role="dialog"
            aria-modal="true"
            className="relative flex min-h-0 max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-lg font-black text-slate-900 truncate">Checklist</p>
                <p className="mt-1 text-xs text-slate-500 font-medium truncate">{selectedTask.title}</p>
                {/* legacy upload copy removed
                  Adjunta imágenes o PDF (máx. 10 MB) como evidencia del checklist.
                */}
                <p className="mt-3 text-[11px] text-slate-400 font-semibold">Registra enlaces URL como evidencia del checklist.</p>
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

            <div className="mt-5 min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Checklist</label>
                {activeTemplate ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 font-black">
                    {activeTemplate.name}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 font-semibold">
                    Esta tarea no tiene checklist asignado o el checklist ya no está disponible.
                  </div>
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
                        className={`flex items-start gap-3 rounded-2xl border border-slate-200 p-4 ${isItemsReadOnly ? 'bg-slate-50' : 'bg-white'}`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(resultsByItemId[it.id])}
                          disabled={isItemsReadOnly}
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
                      disabled={isSubmitting || !activeTemplate || isItemsReadOnly}
                      onClick={saveChecklist}
                      className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all disabled:opacity-70"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting || !activeTemplate || isItemsReadOnly || !isChecklistCompletable}
                      onClick={completeChecklist}
                      className="px-5 py-3 rounded-xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-70"
                    >
                      Completar
                    </button>
                  </div>
                  {!isItemsReadOnly && activeTemplate && !isChecklistCompletable && (
                    <p className="text-[11px] text-slate-400 font-semibold">Marca todos los items requeridos para completar el checklist.</p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Evidencias</p>
                <div className="flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem_auto] sm:items-center">
                    <input
                      type="url"
                      inputMode="url"
                      value={evidenceUrlInput}
                      onChange={(e) => setEvidenceUrlInput(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                      disabled={Boolean(isEvidenceLocked) || !activeTemplate}
                    />
                    <input
                      type="text"
                      value={evidenceLabelInput}
                      onChange={(e) => setEvidenceLabelInput(e.target.value)}
                      placeholder="Nombre opcional"
                      className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                      disabled={Boolean(isEvidenceLocked) || !activeTemplate}
                    />
                    <button
                      type="button"
                      onClick={addEvidenceLink}
                      disabled={isSubmitting || Boolean(isEvidenceLocked) || !activeTemplate}
                      className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all disabled:opacity-70"
                    >
                      <Link2 className="w-4 h-4 inline-block mr-2" />
                      Registrar
                    </button>
                  </div>
                  {/* legacy preview removed
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-4">
                      {evidencePreviewUrl ? (
                        <Image
                          loader={imageLoader}
                          unoptimized
                          src={evidencePreviewUrl}
                          alt={evidenceFile.name}
                          width={56}
                          height={56}
                          className="h-14 w-14 rounded-xl object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                          <FileText className="h-6 w-6 text-slate-500" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{evidenceFile.name}</p>
                        <p className="mt-1 text-xs text-slate-500 font-medium">{Math.ceil(evidenceFile.size / 1024)} KB</p>
                      </div>
                    </div>
                  */}
                  {isEvidenceLocked && (
                    <p className="text-[11px] text-slate-400 font-semibold">No se pueden adjuntar evidencias cuando el checklist ya está aprobado.</p>
                  )}
                </div>

                {evidence.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 font-semibold">
                    Sin evidencias adjuntas.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {evidence.map((ev) => {
                      const isImage = ev.mimeType.startsWith('image/') || /\.(png|jpg|jpeg|webp)$/i.test(ev.fileName);
                      const isPdf = ev.mimeType === 'application/pdf' || /\.pdf$/i.test(ev.fileName);
                      const canDelete = !isEvidenceLocked && ev.uploadedByUserId === user?.id;
                      return (
                        <div key={ev.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex items-start gap-4">
                            <a href={ev.url} target="_blank" rel="noreferrer" className="block">
                              {isImage ? (
                                <Image
                                  loader={imageLoader}
                                  unoptimized
                                  src={ev.url}
                                  alt={ev.fileName}
                                  width={56}
                                  height={56}
                                  className="h-14 w-14 rounded-xl object-cover border border-slate-200"
                                />
                              ) : (
                                <div className="h-14 w-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                                  <FileText className="h-6 w-6 text-slate-500" />
                                </div>
                              )}
                            </a>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black text-slate-900 truncate">{ev.fileName}</p>
                              <p className="mt-1 text-xs text-slate-500 font-medium truncate">
                                {isPdf ? 'PDF' : isImage ? 'Imagen' : ev.mimeType}
                                {typeof ev.sizeBytes === 'number' ? ` · ${Math.ceil(ev.sizeBytes / 1024)} KB` : ''}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <a
                                  href={ev.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all"
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Abrir
                                </a>
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => deleteEvidence(ev)}
                                    disabled={isSubmitting}
                                    className="inline-flex items-center px-3 py-2 rounded-xl bg-white border border-slate-200 text-rose-700 font-bold text-xs hover:bg-rose-50 transition-all disabled:opacity-70"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Eliminar
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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


