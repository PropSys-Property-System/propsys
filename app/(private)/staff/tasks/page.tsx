'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, CheckCircle2, Circle, ListChecks, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import {
  completeStaffTaskChecklist,
  createStaffTaskExecution,
  deleteStaffTaskEvidence,
  listStaffTasksForUser,
  loadStaffTaskChecklistData,
  loadStaffTasksPageData,
  saveStaffTaskChecklist,
  updateStaffTaskStatus,
  uploadStaffTaskEvidence,
} from '@/lib/features/tasks/task-center.data';
import { TaskChecklistDialog } from '@/lib/features/tasks/task-checklist-dialog';
import { labelTaskStatus } from '@/lib/features/tasks/task-center.ui';
import type { ChecklistExecution, ChecklistTemplate, EvidenceAttachment, TaskEntity } from '@/lib/types';

export default function StaffTasksPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allTasks, setAllTasks] = useState<TaskEntity[]>([]);
  const [buildingNameById, setBuildingNameById] = useState<Record<string, string>>({});
  const [statusById, setStatusById] = useState<Record<string, TaskEntity['status']>>({});

  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskEntity | null>(null);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [execution, setExecution] = useState<ChecklistExecution | null>(null);
  const [resultsByItemId, setResultsByItemId] = useState<Record<string, boolean>>({});
  const [evidence, setEvidence] = useState<EvidenceAttachment[]>([]);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreviewUrl, setEvidencePreviewUrl] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearEvidenceDraft = React.useCallback(() => {
    setEvidenceFile(null);
    setEvidencePreviewUrl((current) => {
      if (current?.startsWith('blob:')) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }, []);

  const selectEvidenceFile = React.useCallback(
    (file: File | null) => {
      if (!file) return;

      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.name);

      if (!isPdf && !isImage) {
        clearEvidenceDraft();
        setActionError('Tipo de archivo no permitido. Solo imagenes o PDF.');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        clearEvidenceDraft();
        setActionError('El archivo supera el limite de 10 MB.');
        return;
      }

      setActionError(null);
      setEvidenceFile(file);
      setEvidencePreviewUrl((current) => {
        if (current?.startsWith('blob:')) {
          URL.revokeObjectURL(current);
        }
        return isImage ? URL.createObjectURL(file) : null;
      });
    },
    [clearEvidenceDraft]
  );

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await loadStaffTasksPageData(user);
        if (!isMounted) return;
        setAllTasks(data.tasks);
        setBuildingNameById(data.buildingNameById);
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

  useEffect(
    () => () => {
      if (evidencePreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(evidencePreviewUrl);
      }
    },
    [evidencePreviewUrl]
  );

  const tasks = useMemo(() => {
    const normalizedTerm = searchTerm.toLowerCase();
    return allTasks.filter(
      (task) =>
        task.title.toLowerCase().includes(normalizedTerm) ||
        (task.description ?? '').toLowerCase().includes(normalizedTerm)
    );
  }, [allTasks, searchTerm]);

  const reload = async () => {
    if (!user) return;
    const data = await listStaffTasksForUser(user);
    setAllTasks(data);
  };

  const updateStatus = async (id: string) => {
    if (!user) return;

    const nextStatus = statusById[id];
    if (!nextStatus) return;

    try {
      setIsSubmitting(true);
      setActionError(null);
      await updateStaffTaskStatus(user, { taskId: id, status: nextStatus });
      await reload();
      setStatusById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
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
    clearEvidenceDraft();
    setTemplates([]);
    setSelectedTemplateId('');
    setExecution(null);
    setResultsByItemId({});
    setEvidence([]);

    try {
      const data = await loadStaffTaskChecklistData(user, task);
      if (!data.template) {
        setActionError('El checklist asignado ya no esta disponible.');
        return;
      }

      setTemplates([data.template]);
      setSelectedTemplateId(data.template.id);
      setExecution(data.execution);
      setResultsByItemId(data.resultsByItemId);
      setEvidence(data.evidence);

      if (data.evidenceError) {
        setActionError(data.evidenceError);
      }
    } catch {
      setActionError('No pudimos cargar el estado del checklist de esta tarea.');
    }
  };

  const closeChecklist = () => {
    clearEvidenceDraft();
    setActionError(null);
    setIsChecklistOpen(false);
  };

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates]
  );

  const isItemsReadOnly = execution?.status === 'COMPLETED' || execution?.status === 'APPROVED';
  const isEvidenceLocked = execution?.status === 'APPROVED';

  const isChecklistCompletable = useMemo(() => {
    if (!activeTemplate) return false;
    const requiredItems = activeTemplate.items.filter((item) => item.required);
    if (requiredItems.length === 0) return true;
    return requiredItems.every((item) => Boolean(resultsByItemId[item.id]));
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
      const created = await createStaffTaskExecution(user, {
        taskId: selectedTask.id,
        templateId: selectedTemplateId,
      });
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
    if (!activeTemplate) return [];
    return activeTemplate.items.map((item) => ({
      itemId: item.id,
      value: Boolean(resultsByItemId[item.id]),
    }));
  };

  const saveChecklist = async () => {
    if (!user) return;
    const currentExecution = await ensureExecution();
    if (!currentExecution) return;

    try {
      setIsSubmitting(true);
      setActionError(null);
      const updated = await saveStaffTaskChecklist(user, {
        executionId: currentExecution.id,
        results: buildResults(),
      });
      setExecution(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos guardar el checklist.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeChecklist = async () => {
    if (!user) return;
    const currentExecution = await ensureExecution();
    if (!currentExecution) return;

    try {
      setIsSubmitting(true);
      setActionError(null);
      const updated = await completeStaffTaskChecklist(user, {
        executionId: currentExecution.id,
        results: buildResults(),
      });
      setExecution(updated);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos completar el checklist.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadEvidence = async () => {
    if (!user) return;
    const currentExecution = await ensureExecution();
    if (!currentExecution) return;

    if (currentExecution.status === 'APPROVED') {
      setActionError('No puedes adjuntar evidencias a un checklist aprobado.');
      return;
    }

    if (!evidenceFile) {
      setActionError('Selecciona una foto o un archivo PDF.');
      return;
    }

    try {
      setIsSubmitting(true);
      setActionError(null);
      const created = await uploadStaffTaskEvidence(user, {
        checklistExecutionId: currentExecution.id,
        file: evidenceFile,
      });
      clearEvidenceDraft();
      setEvidence((prev) => [created, ...prev]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos adjuntar la evidencia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteEvidence = async (item: EvidenceAttachment) => {
    if (!user) return;
    if (isEvidenceLocked) {
      setActionError('No puedes eliminar evidencias de un checklist aprobado.');
      return;
    }

    const confirmed = window.confirm(`Eliminar evidencia "${item.fileName}"?`);
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      setActionError(null);
      await deleteStaffTaskEvidence(user, item.id);
      setEvidence((prev) => prev.filter((evidenceItem) => evidenceItem.id !== item.id));
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
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar tareas..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
          />
        </div>

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando tareas..." />
        ) : tasks.length === 0 ? (
          <EmptyState
            title="Sin tareas"
            description={searchTerm ? `No hay resultados para "${searchTerm}".` : 'No hay tareas asignadas para este turno.'}
          />
        ) : (
          <div className="space-y-3 max-w-3xl">
            {tasks.map((task) => {
              const nextStatuses = allowedNextStatuses(task);
              const canChangeStatus =
                task.status !== 'COMPLETED' && task.status !== 'APPROVED' && nextStatuses.length > 0;

              return (
                <div key={task.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {buildingNameById[task.buildingId] ?? task.buildingId}
                      </span>
                    </div>

                    <p className="text-sm font-black text-slate-900">{task.title}</p>
                    {task.description && <p className="mt-1 text-xs text-slate-500 font-medium">{task.description}</p>}

                    <p className="mt-2 text-[11px] font-semibold text-slate-500">
                      Edificio: {buildingNameById[task.buildingId] ?? task.buildingId}
                    </p>

                    <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {labelTaskStatus(task.status)}
                    </p>

                    {canChangeStatus && (
                      <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
                        <select
                          value={statusById[task.id] ?? ''}
                          onChange={(event) =>
                            setStatusById((prev) => ({
                              ...prev,
                              [task.id]: event.target.value as TaskEntity['status'],
                            }))
                          }
                          className="w-full sm:w-56 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-xs font-bold"
                        >
                          <option value="" disabled>
                            Cambiar estado...
                          </option>
                          {nextStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status === 'IN_PROGRESS' ? 'En progreso' : 'Completada'}
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
                    )}

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => openChecklist(task)}
                        disabled={!task.checklistTemplateId}
                        className="inline-flex items-center px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all"
                      >
                        <ListChecks className="w-4 h-4 mr-2" /> Checklist y evidencias
                      </button>

                      {!task.checklistTemplateId && (
                        <p className="mt-2 text-[11px] text-slate-400 font-semibold">
                          Esta tarea no tiene checklist asignado.
                        </p>
                      )}

                      {task.checklistTemplateId && task.status === 'IN_PROGRESS' && (
                        <p className="mt-2 text-[11px] text-slate-400 font-semibold">
                          Completa el checklist para finalizar la tarea.
                        </p>
                      )}
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
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-center py-4">
          <div className="flex items-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
            <ClipboardList className="w-4 h-4 mr-2" /> PropSys Staff
          </div>
        </div>
      </div>

      <TaskChecklistDialog
        isOpen={isChecklistOpen}
        task={selectedTask}
        buildingName={selectedTask ? (buildingNameById[selectedTask.buildingId] ?? selectedTask.buildingId) : null}
        actionError={actionError}
        activeTemplate={activeTemplate}
        execution={execution}
        resultsByItemId={resultsByItemId}
        evidence={evidence}
        evidenceFile={evidenceFile}
        evidencePreviewUrl={evidencePreviewUrl}
        isItemsReadOnly={isItemsReadOnly}
        isEvidenceLocked={isEvidenceLocked}
        isChecklistCompletable={isChecklistCompletable}
        isSubmitting={isSubmitting}
        currentUserId={user?.id}
        onClose={closeChecklist}
        onSelectEvidenceFile={selectEvidenceFile}
        onClearEvidenceDraft={clearEvidenceDraft}
        onToggleResult={(itemId, value) =>
          setResultsByItemId((prev) => ({
            ...prev,
            [itemId]: value,
          }))
        }
        onSaveChecklist={saveChecklist}
        onCompleteChecklist={completeChecklist}
        onUploadEvidence={uploadEvidence}
        onDeleteEvidence={deleteEvidence}
      />
    </div>
  );
}
