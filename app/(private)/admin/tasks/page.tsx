'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ChevronDown, Plus, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { buildingsRepo, checklistExecutionsRepo, checklistTemplatesRepo, staffRepo, tasksRepo } from '@/lib/data';
import { formatDateTime } from '@/lib/presentation/dates';
import type { ChecklistTemplate, StaffMember, TaskEntity } from '@/lib/types';

function labelTaskStatus(status: TaskEntity['status']) {
  if (status === 'APPROVED') return 'Aprobada';
  if (status === 'COMPLETED') return 'Completada';
  if (status === 'IN_PROGRESS') return 'En progreso';
  return 'Pendiente';
}

export default function AdminTasksPage() {
  const { user } = useAuth();
  const [allTasks, setAllTasks] = useState<TaskEntity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([]);
  const [staffByBuildingId, setStaffByBuildingId] = useState<Record<string, StaffMember[]>>({});
  const [templatesByBuildingId, setTemplatesByBuildingId] = useState<Record<string, ChecklistTemplate[]>>({});

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createBuildingId, setCreateBuildingId] = useState('');
  const [createAssigneeId, setCreateAssigneeId] = useState('');
  const [createChecklistMode, setCreateChecklistMode] = useState<'NONE' | 'TEMPLATE' | 'MANUAL'>('NONE');
  const [createChecklistTemplateId, setCreateChecklistTemplateId] = useState<string>('');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createManualChecklistName, setCreateManualChecklistName] = useState('');
  const [createManualItems, setCreateManualItems] = useState<Array<{ label: string; required: boolean; order: number }>>([
    { label: '', required: true, order: 1 },
  ]);

  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [templateBuildingId, setTemplateBuildingId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateItems, setTemplateItems] = useState<Array<{ label: string; required: boolean }>>([{ label: '', required: true }]);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templatesBuildingId, setTemplatesBuildingId] = useState('');
  const [isTemplatesExpanded, setIsTemplatesExpanded] = useState(false);

  const [assigneeByTaskId, setAssigneeByTaskId] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setError(null);
        setActionError(null);
        setTemplatesError(null);

        const [tasks, b] = await Promise.all([
          tasksRepo.listForUser(user),
          buildingsRepo.listForUser(user),
        ]);
        if (!isMounted) return;
        setAllTasks(tasks);
        setBuildings(b.map((x) => ({ id: x.id, name: x.name })));
        setCreateBuildingId((prev) => prev || b[0]?.id || '');
        setTemplatesBuildingId((prev) => prev || b[0]?.id || '');

        const staffLists = await Promise.allSettled(b.map((x) => staffRepo.listForBuilding(user, x.id)));
        if (!isMounted) return;
        const next: Record<string, StaffMember[]> = {};
        for (let i = 0; i < b.length; i += 1) {
          const staffList = staffLists[i];
          next[b[i].id] = staffList.status === 'fulfilled' ? staffList.value : [];
        }
        setStaffByBuildingId(next);

        try {
          const templates = await checklistTemplatesRepo.listForUser(user);
          if (!isMounted) return;
          const templatesGrouped: Record<string, ChecklistTemplate[]> = {};
          for (const t of templates) {
            if (!templatesGrouped[t.buildingId]) templatesGrouped[t.buildingId] = [];
            templatesGrouped[t.buildingId].push(t);
          }
          setTemplatesByBuildingId(templatesGrouped);
          setTemplatesError(null);
        } catch {
          if (!isMounted) return;
          setTemplatesByBuildingId({});
          setTemplatesError('No pudimos cargar los checklists reutilizables.');
        }
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar las tareas.');
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

  useEffect(() => {
    const list = staffByBuildingId[createBuildingId] ?? [];
    const activeStaff = list.filter((m) => m.role === 'Personal' && m.status === 'ACTIVE');
    setCreateAssigneeId((prev) => prev || activeStaff[0]?.id || '');
  }, [createBuildingId, staffByBuildingId]);

  useEffect(() => {
    const templates = templatesByBuildingId[createBuildingId] ?? [];
    if (createChecklistMode === 'TEMPLATE') {
      setCreateChecklistTemplateId((prev) => prev || templates[0]?.id || '');
      return;
    }
    setCreateChecklistTemplateId('');
  }, [createBuildingId, templatesByBuildingId, createChecklistMode]);

  useEffect(() => {
    setTemplateBuildingId((prev) => prev || createBuildingId);
  }, [createBuildingId]);

  useEffect(() => {
    setTemplatesBuildingId((prev) => prev || createBuildingId);
  }, [createBuildingId]);

  const reload = async () => {
    if (!user) return;
    setActionError(null);
    const data = await tasksRepo.listForUser(user);
    setAllTasks(data);
  };

  const tasks = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return allTasks.filter((x) => x.title.toLowerCase().includes(t) || (x.description ?? '').toLowerCase().includes(t));
  }, [allTasks, searchTerm]);

  const canManage = user?.internalRole === 'BUILDING_ADMIN' || user?.internalRole === 'CLIENT_MANAGER' || user?.internalRole === 'ROOT_ADMIN';

  const submitCreate = async () => {
    if (!user) return;
    if (!createBuildingId) {
      setActionError('Selecciona un edificio.');
      return;
    }
    if (!createAssigneeId) {
      setActionError('Selecciona un miembro del staff.');
      return;
    }
    if (createChecklistMode === 'TEMPLATE' && !createChecklistTemplateId) {
      setActionError('Selecciona un checklist.');
      return;
    }
    if (createChecklistMode === 'MANUAL') {
      const normalized = createManualItems
        .map((it) => ({ label: it.label.trim(), required: it.required, order: it.order }))
        .filter((it) => it.label);
      if (normalized.length === 0) {
        setActionError('Agrega al menos un item.');
        return;
      }
    }
    if (!createTitle.trim()) {
      setActionError('Completa el título.');
      return;
    }
    try {
      setIsSubmitting(true);
      setActionError(null);
      const manualItems =
        createChecklistMode === 'MANUAL'
          ? createManualItems
              .map((it) => ({ label: it.label.trim(), required: it.required, order: it.order }))
              .filter((it) => it.label)
          : undefined;
      await tasksRepo.createForUser(user, {
        buildingId: createBuildingId,
        assignedToUserId: createAssigneeId,
        checklistTemplateId: createChecklistMode === 'TEMPLATE' ? createChecklistTemplateId : undefined,
        manualChecklistName: createChecklistMode === 'MANUAL' ? createManualChecklistName.trim() || undefined : undefined,
        manualChecklistItems: manualItems,
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
      });
      setIsCreateOpen(false);
      setCreateChecklistTemplateId('');
      setCreateChecklistMode('NONE');
      setCreateManualChecklistName('');
      setCreateManualItems([{ label: '', required: true, order: 1 }]);
      setCreateTitle('');
      setCreateDescription('');
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos crear la tarea.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitTemplate = async () => {
    if (!user) return;
    if (!templateBuildingId) {
      setActionError('Selecciona un edificio.');
      return;
    }
    if (!templateName.trim()) {
      setActionError('Completa el nombre del checklist.');
      return;
    }
    const normalizedItems = templateItems.map((it) => ({ label: it.label.trim(), required: it.required })).filter((it) => it.label);
    if (normalizedItems.length === 0) {
      setActionError('Agrega al menos un item.');
      return;
    }
    try {
      setIsSubmitting(true);
      setActionError(null);
      if (editingTemplateId) {
        const updated = await checklistTemplatesRepo.updateForUser(user, editingTemplateId, {
          name: templateName.trim(),
          items: normalizedItems,
        });
        if (!updated) {
          setActionError('No pudimos guardar el checklist.');
          return;
        }
        setTemplatesByBuildingId((prev) => {
          const currentList = prev[updated.buildingId] ?? [];
          const withoutOriginal = currentList.filter((t) => t.id !== editingTemplateId);
          const hasUpdated = withoutOriginal.some((t) => t.id === updated.id);
          return {
            ...prev,
            [updated.buildingId]: hasUpdated
              ? withoutOriginal.map((t) => (t.id === updated.id ? updated : t))
              : [updated, ...withoutOriginal],
          };
        });
        if (createChecklistTemplateId === editingTemplateId) {
          setCreateChecklistTemplateId(updated.id);
        }
      } else {
        const created = await checklistTemplatesRepo.createForUser(user, {
          buildingId: templateBuildingId,
          name: templateName.trim(),
          items: normalizedItems,
        });
        setTemplatesByBuildingId((prev) => ({
          ...prev,
          [templateBuildingId]: [created, ...(prev[templateBuildingId] ?? [])],
        }));
        if (createBuildingId === templateBuildingId && !createChecklistTemplateId) {
          setCreateChecklistTemplateId(created.id);
        }
      }
      setIsTemplateOpen(false);
      setTemplateName('');
      setTemplateItems([{ label: '', required: true }]);
      setEditingTemplateId(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : editingTemplateId ? 'No pudimos guardar el checklist.' : 'No pudimos crear el checklist.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const editTemplate = (t: ChecklistTemplate) => {
    setActionError(null);
    setEditingTemplateId(t.id);
    setTemplateBuildingId(t.buildingId);
    setTemplateName(t.name);
    setTemplateItems(t.items.map((it) => ({ label: it.label, required: it.required })));
    setIsTemplateOpen(true);
  };

  const deleteTemplate = async (t: ChecklistTemplate) => {
    if (!user) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      await checklistTemplatesRepo.deleteForUser(user, t.id);
      setTemplatesByBuildingId((prev) => ({
        ...prev,
        [t.buildingId]: (prev[t.buildingId] ?? []).filter((x) => x.id !== t.id),
      }));
      if (createChecklistTemplateId === t.id) setCreateChecklistTemplateId('');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos eliminar el checklist.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const approveTask = async (id: string) => {
    if (!user) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      await tasksRepo.updateForUser(user, id, { status: 'APPROVED' });
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos aprobar la tarea.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const approveChecklistForTask = async (taskId: string) => {
    if (!user) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      const executions = await checklistExecutionsRepo.listForTask(user, taskId);
      const current = executions[0] ?? null;
      if (!current) {
        setActionError('Esta tarea no tiene checklist iniciado.');
        return;
      }
      if (current.status !== 'COMPLETED') {
        setActionError('Solo se puede aprobar cuando el checklist esté completado.');
        return;
      }
      await checklistExecutionsRepo.approveForUser(user, current.id);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos aprobar el checklist.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveAssignee = async (task: TaskEntity) => {
    if (!user) return;
    const nextAssigneeId = assigneeByTaskId[task.id];
    if (!nextAssigneeId || nextAssigneeId === task.assignedToUserId) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      await tasksRepo.updateForUser(user, task.id, { assignedToUserId: nextAssigneeId });
      await reload();
      setAssigneeByTaskId((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos asignar la tarea.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const actions = (
    canManage ? (
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            setActionError(null);
            setTemplateBuildingId((prev) => prev || createBuildingId);
            setTemplateName('');
            setTemplateItems([{ label: '', required: true }]);
            setEditingTemplateId(null);
            setIsTemplateOpen(true);
          }}
          className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
        >
          <Plus className="w-4 h-4 mr-2" /> Nuevo checklist
        </button>
        <button
          onClick={() => {
            setActionError(null);
            setCreateChecklistMode('NONE');
            setCreateChecklistTemplateId('');
            setCreateManualChecklistName('');
            setCreateManualItems([{ label: '', required: true, order: 1 }]);
            setIsCreateOpen(true);
          }}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
        >
          <Plus className="w-4 h-4 mr-2" /> Nueva tarea
        </button>
      </div>
    ) : null
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Tareas" description="Crea, asigna y aprueba tareas operativas" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        {actionError && <ErrorState title="Acción no disponible" description={actionError} />}
        {templatesError && canManage && !error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            {templatesError}
          </div>
        )}

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

        {canManage && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-4xl">
            <button
              type="button"
              onClick={() => setIsTemplatesExpanded((prev) => !prev)}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Checklists</p>
                <p className="mt-2 text-sm text-slate-600 font-medium">Crea y reutiliza checklists por edificio.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {(templatesByBuildingId[templatesBuildingId] ?? []).length} templates
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-slate-400 transition-transform ${isTemplatesExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            {isTemplatesExpanded && (
              <div className="mt-4 space-y-4">
                <div className="w-full sm:w-72">
                  <select
                    value={templatesBuildingId}
                    onChange={(e) => setTemplatesBuildingId(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                  >
                    <option value="" disabled>
                      Selecciona edificio...
                    </option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  {(templatesByBuildingId[templatesBuildingId] ?? []).length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 font-semibold">
                      No hay templates para este edificio.
                    </div>
                  ) : (
                    (templatesByBuildingId[templatesBuildingId] ?? []).map((t) => (
                      <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 truncate">{t.name}</p>
                          <p className="mt-1 text-xs text-slate-500 font-medium">{t.items.length} items</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => editTemplate(t)}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all disabled:opacity-60"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => deleteTemplate(t)}
                            className="px-4 py-2 bg-white border border-slate-200 text-rose-700 rounded-xl font-bold text-xs hover:bg-rose-50 transition-all disabled:opacity-60"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando tareas..." />
        ) : tasks.length === 0 ? (
          <EmptyState title="Sin tareas" description={searchTerm ? `No hay resultados para "${searchTerm}".` : 'Aún no hay tareas registradas.'} />
        ) : (
          <div className="space-y-3 max-w-4xl">
            {tasks.map((task) => {
              const staff = (staffByBuildingId[task.buildingId] ?? []).filter((m) => m.role === 'Personal' && m.status === 'ACTIVE');
              const canEditAssignee = canManage && task.status !== 'APPROVED';
              return (
                <div key={task.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                        {labelTaskStatus(task.status)}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                        {task.buildingId}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-black text-slate-900 truncate">{task.title}</p>
                    {task.description && <p className="mt-1 text-xs text-slate-500 font-medium line-clamp-2">{task.description}</p>}
                    <p className="mt-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Creado {formatDateTime(task.createdAt)}
                    </p>

                    {canEditAssignee && (
                      <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
                        <select
                          value={assigneeByTaskId[task.id] ?? task.assignedToUserId}
                          onChange={(e) => setAssigneeByTaskId((prev) => ({ ...prev, [task.id]: e.target.value }))}
                          className="w-full sm:w-72 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-xs font-bold"
                        >
                          {staff.length === 0 ? (
                            <option value={task.assignedToUserId}>Sin staff activo</option>
                          ) : (
                            staff.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))
                          )}
                        </select>
                        <button
                          disabled={isSubmitting || !assigneeByTaskId[task.id] || assigneeByTaskId[task.id] === task.assignedToUserId || staff.length === 0}
                          onClick={() => saveAssignee(task)}
                          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all disabled:opacity-60"
                        >
                          Guardar asignación
                        </button>
                      </div>
                    )}

                    {canManage && task.status === 'COMPLETED' && (
                      <div className="mt-4">
                        <button
                          disabled={isSubmitting}
                          onClick={() => (task.checklistTemplateId ? approveChecklistForTask(task.id) : approveTask(task.id))}
                          className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all disabled:opacity-60"
                        >
                          {task.checklistTemplateId ? 'Aprobar checklist' : 'Aprobar'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="Cerrar" className="absolute inset-0 bg-black/30" onClick={() => setIsCreateOpen(false)} type="button" />
          <div role="dialog" aria-modal="true" className="relative flex min-h-0 max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-black text-slate-900">Nueva tarea</p>
                <p className="mt-1 text-xs text-slate-500 font-medium">Crea una tarea y asígnala a personal activo del edificio.</p>
              </div>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700">
                Cerrar
              </button>
            </div>

            <div className="mt-5 min-h-0 space-y-3 overflow-y-auto pr-1">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Edificio</label>
                <select
                  value={createBuildingId}
                  onChange={(e) => {
                    setCreateBuildingId(e.target.value);
                    setCreateAssigneeId('');
                    setCreateChecklistTemplateId('');
                    setCreateChecklistMode('NONE');
                    setCreateManualChecklistName('');
                    setCreateManualItems([{ label: '', required: true, order: 1 }]);
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
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Asignar a</label>
                <select
                  value={createAssigneeId}
                  onChange={(e) => setCreateAssigneeId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                >
                  {(staffByBuildingId[createBuildingId] ?? [])
                    .filter((m) => m.role === 'Personal' && m.status === 'ACTIVE')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Checklist</label>
                <select
                  value={createChecklistMode}
                  onChange={(e) => setCreateChecklistMode(e.target.value as 'NONE' | 'TEMPLATE' | 'MANUAL')}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                >
                  <option value="NONE">Sin checklist</option>
                  <option value="TEMPLATE">Usar template existente</option>
                  <option value="MANUAL">Checklist manual</option>
                </select>

                {createChecklistMode === 'NONE' && (
                  <p className="mt-2 text-[11px] text-slate-400 font-semibold">La tarea se completará manualmente (sin checklist).</p>
                )}

                {createChecklistMode === 'TEMPLATE' && (
                  <div className="mt-3">
                    {(templatesByBuildingId[createBuildingId] ?? []).length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 font-semibold">
                        Este edificio no tiene templates disponibles.
                      </div>
                    ) : (
                      <select
                        value={createChecklistTemplateId}
                        onChange={(e) => setCreateChecklistTemplateId(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                      >
                        <option value="" disabled>
                          Selecciona un template...
                        </option>
                        {(templatesByBuildingId[createBuildingId] ?? []).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {createChecklistMode === 'MANUAL' && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Nombre (opcional)</label>
                      <input
                        value={createManualChecklistName}
                        onChange={(e) => setCreateManualChecklistName(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Items</p>
                      <button
                        type="button"
                        onClick={() =>
                          setCreateManualItems((prev) => [...prev, { label: '', required: false, order: prev.length + 1 }])
                        }
                        className="px-3 py-2 text-xs font-black text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
                      >
                        Agregar item
                      </button>
                    </div>

                    <div className="space-y-2">
                      {createManualItems.map((it, idx) => (
                        <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_110px_auto_auto] md:items-end">
                            <div>
                              <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                Item
                              </label>
                              <input
                                value={it.label}
                                onChange={(e) =>
                                  setCreateManualItems((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                                }
                                placeholder={`Item ${idx + 1}`}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                              />
                            </div>
                            <div>
                              <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                Orden
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={it.order}
                                onChange={(e) =>
                                  setCreateManualItems((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, order: Number(e.target.value) } : x))
                                  )
                                }
                                className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                              />
                            </div>
                            <label className="flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-xs font-black text-slate-700">
                              <input
                                type="checkbox"
                                checked={it.required}
                                onChange={(e) =>
                                  setCreateManualItems((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, required: e.target.checked } : x))
                                  )
                                }
                                className="h-4 w-4"
                              />
                              Requerido
                            </label>
                            <button
                              type="button"
                              disabled={createManualItems.length === 1}
                              onClick={() =>
                                setCreateManualItems((prev) => {
                                  const next = [...prev];
                                  next.splice(idx, 1);
                                  return next;
                                })
                              }
                              className="min-h-[48px] px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700 disabled:opacity-50"
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Descripción (opcional)</label>
                <textarea
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium min-h-[120px]"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
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

      {isTemplateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="Cerrar" className="absolute inset-0 bg-black/30" onClick={() => setIsTemplateOpen(false)} type="button" />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-black text-slate-900">{editingTemplateId ? 'Editar checklist' : 'Nuevo checklist'}</p>
                <p className="mt-1 text-xs text-slate-500 font-medium">
                  {editingTemplateId ? 'Edita nombre e items del checklist.' : 'Crea un template de checklist para un edificio.'}
                </p>
              </div>
              <button type="button" onClick={() => setIsTemplateOpen(false)} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700">
                Cerrar
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Edificio</label>
                <select
                  value={templateBuildingId}
                  onChange={(e) => setTemplateBuildingId(e.target.value)}
                  disabled={Boolean(editingTemplateId)}
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
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Nombre</label>
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Items</p>
                  <button
                    type="button"
                    onClick={() => setTemplateItems((prev) => [...prev, { label: '', required: false }])}
                    className="px-3 py-2 text-xs font-black text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Agregar item
                  </button>
                </div>

                <div className="space-y-2">
                  {templateItems.map((it, idx) => (
                    <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                        <input
                          value={it.label}
                          onChange={(e) =>
                            setTemplateItems((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                          }
                          placeholder={`Item ${idx + 1}`}
                          className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                        />
                        <label className="flex items-center gap-2 text-xs font-black text-slate-700">
                          <input
                            type="checkbox"
                            checked={it.required}
                            onChange={(e) =>
                              setTemplateItems((prev) => prev.map((x, i) => (i === idx ? { ...x, required: e.target.checked } : x)))
                            }
                            className="h-4 w-4"
                          />
                          Requerido
                        </label>
                        <button
                          type="button"
                          disabled={templateItems.length === 1}
                          onClick={() =>
                            setTemplateItems((prev) => {
                              const next = [...prev];
                              next.splice(idx, 1);
                              return next;
                            })
                          }
                          className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700 disabled:opacity-50"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setIsTemplateOpen(false)}
                className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={submitTemplate}
                className="px-5 py-3 rounded-xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-70"
              >
                {editingTemplateId ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
