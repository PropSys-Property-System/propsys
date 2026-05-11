import type { ChecklistExecution, ChecklistTemplate, EvidenceAttachment, StaffMember, TaskEntity, User } from '@/lib/types';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { staffRepo } from '@/lib/repos/physical/staff.repo';
import { checklistExecutionsRepo } from '@/lib/repos/operation/checklist-executions.repo';
import { checklistTemplatesRepo } from '@/lib/repos/operation/checklist-templates.repo';
import { evidenceRepo } from '@/lib/repos/operation/evidence.repo';
import { tasksRepo } from '@/lib/repos/operation/tasks.repo';

export type AdminTasksPageData = {
  tasks: TaskEntity[];
  buildings: Array<{ id: string; name: string }>;
  staffByBuildingId: Record<string, StaffMember[]>;
  templatesByBuildingId: Record<string, ChecklistTemplate[]>;
  templatesError: string | null;
};

export type AdminTaskReviewData = {
  template: ChecklistTemplate | null;
  execution: ChecklistExecution | null;
  evidence: EvidenceAttachment[];
  reviewCommentDraft: string;
};

export type StaffTasksPageData = {
  tasks: TaskEntity[];
  buildingNameById: Record<string, string>;
};

export type StaffTaskChecklistData = {
  template: ChecklistTemplate | null;
  execution: ChecklistExecution | null;
  evidence: EvidenceAttachment[];
  resultsByItemId: Record<string, boolean>;
  evidenceError: string | null;
};

export type CreateAdminTaskInput = {
  buildingId: string;
  assignedToUserId: string;
  checklistTemplateId?: string;
  title: string;
  description?: string;
  manualChecklistName?: string;
  manualChecklistItems?: Array<{ label: string; required: boolean; order: number }>;
};

export type SaveAdminTaskTemplateInput = {
  templateId?: string;
  buildingId: string;
  name: string;
  items: Array<{ label: string; required: boolean }>;
};

export type ReassignAdminTaskInput = {
  taskId: string;
  assignedToUserId: string;
};

export type ReturnAdminChecklistInput = {
  executionId: string;
  comment?: string;
};

export type UpdateStaffTaskStatusInput = {
  taskId: string;
  status: TaskEntity['status'];
};

export type CreateStaffTaskExecutionInput = {
  taskId: string;
  templateId: string;
};

export type SaveStaffChecklistInput = {
  executionId: string;
  results: ChecklistExecution['results'];
};

export type UploadStaffEvidenceInput = {
  checklistExecutionId: string;
  file: File;
};

export async function loadAdminTasksPageData(user: User): Promise<AdminTasksPageData> {
  const [tasks, buildings] = await Promise.all([tasksRepo.listForUser(user), buildingsRepo.listForUser(user)]);
  const buildingOptions = buildings.map((building) => ({ id: building.id, name: building.name }));

  const [staffLists, templatesResult] = await Promise.all([
    Promise.allSettled(buildingOptions.map((building) => staffRepo.listForBuilding(user, building.id))),
    checklistTemplatesRepo
      .listForUser(user)
      .then((templates) => ({ templates, error: null as string | null }))
      .catch(() => ({ templates: [] as ChecklistTemplate[], error: 'No pudimos cargar los checklists reutilizables.' })),
  ]);

  const staffByBuildingId: Record<string, StaffMember[]> = {};
  for (let index = 0; index < buildingOptions.length; index += 1) {
    const staffList = staffLists[index];
    staffByBuildingId[buildingOptions[index].id] = staffList.status === 'fulfilled' ? staffList.value : [];
  }

  const templatesByBuildingId: Record<string, ChecklistTemplate[]> = {};
  for (const template of templatesResult.templates) {
    if (!templatesByBuildingId[template.buildingId]) {
      templatesByBuildingId[template.buildingId] = [];
    }
    templatesByBuildingId[template.buildingId].push(template);
  }

  return {
    tasks,
    buildings: buildingOptions,
    staffByBuildingId,
    templatesByBuildingId,
    templatesError: templatesResult.error,
  };
}

export async function listAdminTasksForUser(user: User): Promise<TaskEntity[]> {
  return tasksRepo.listForUser(user);
}

export async function loadAdminTaskReviewData(user: User, task: TaskEntity): Promise<AdminTaskReviewData> {
  if (!task.checklistTemplateId) {
    throw new Error('Esta tarea no tiene checklist asignado.');
  }

  const [template, executions] = await Promise.all([
    checklistTemplatesRepo.getByIdForUser(user, task.checklistTemplateId),
    checklistExecutionsRepo.listForTask(user, task.id),
  ]);

  const execution = executions[0] ?? null;
  const evidence = execution ? await evidenceRepo.listForChecklistExecution(user, execution.id) : [];

  return {
    template,
    execution,
    evidence,
    reviewCommentDraft: execution?.lastReviewAction === 'RETURN' ? execution.reviewComment ?? '' : '',
  };
}

export async function createAdminTask(user: User, input: CreateAdminTaskInput): Promise<TaskEntity> {
  return tasksRepo.createForUser(user, input);
}

export async function saveAdminTaskTemplate(user: User, input: SaveAdminTaskTemplateInput): Promise<ChecklistTemplate> {
  if (input.templateId) {
    const updated = await checklistTemplatesRepo.updateForUser(user, input.templateId, {
      name: input.name,
      items: input.items,
    });
    if (!updated) throw new Error('No pudimos guardar el checklist.');
    return updated;
  }

  return checklistTemplatesRepo.createForUser(user, {
    buildingId: input.buildingId,
    name: input.name,
    items: input.items,
  });
}

export async function deleteAdminTaskTemplate(user: User, templateId: string): Promise<void> {
  await checklistTemplatesRepo.deleteForUser(user, templateId);
}

export async function approveAdminTask(user: User, taskId: string): Promise<TaskEntity> {
  const updated = await tasksRepo.updateForUser(user, taskId, { status: 'APPROVED' });
  if (!updated) throw new Error('No pudimos aprobar la tarea.');
  return updated;
}

export async function reassignAdminTask(user: User, input: ReassignAdminTaskInput): Promise<TaskEntity> {
  const updated = await tasksRepo.updateForUser(user, input.taskId, { assignedToUserId: input.assignedToUserId });
  if (!updated) throw new Error('No pudimos asignar la tarea.');
  return updated;
}

export async function approveAdminChecklist(user: User, executionId: string): Promise<ChecklistExecution> {
  const updated = await checklistExecutionsRepo.approveForUser(user, executionId);
  if (!updated) throw new Error('No pudimos aprobar el checklist.');
  return updated;
}

export async function returnAdminChecklist(user: User, input: ReturnAdminChecklistInput): Promise<ChecklistExecution> {
  const updated = await checklistExecutionsRepo.returnForUser(user, input.executionId, { comment: input.comment });
  if (!updated) throw new Error('No pudimos devolver el checklist al staff.');
  return updated;
}

export async function loadStaffTasksPageData(user: User): Promise<StaffTasksPageData> {
  const [tasks, buildings] = await Promise.all([tasksRepo.listForUser(user), buildingsRepo.listForUser(user)]);

  return {
    tasks,
    buildingNameById: Object.fromEntries(buildings.map((building) => [building.id, building.name])),
  };
}

export async function listStaffTasksForUser(user: User): Promise<TaskEntity[]> {
  return tasksRepo.listForUser(user);
}

export async function loadStaffTaskChecklistData(user: User, task: TaskEntity): Promise<StaffTaskChecklistData> {
  if (!task.checklistTemplateId) {
    throw new Error('Esta tarea no tiene checklist asignado.');
  }

  const template = await checklistTemplatesRepo.getByIdForUser(user, task.checklistTemplateId);
  if (!template) {
    return {
      template: null,
      execution: null,
      evidence: [],
      resultsByItemId: {},
      evidenceError: null,
    };
  }

  const executions = await checklistExecutionsRepo.listForTask(user, task.id);
  const execution = executions[0] ?? null;
  const resultsByItemId: Record<string, boolean> = {};
  for (const result of execution?.results ?? []) {
    resultsByItemId[result.itemId] = Boolean(result.value);
  }

  try {
    const evidence = execution ? await evidenceRepo.listForChecklistExecution(user, execution.id) : [];
    return {
      template,
      execution,
      evidence,
      resultsByItemId,
      evidenceError: null,
    };
  } catch {
    return {
      template,
      execution,
      evidence: [],
      resultsByItemId,
      evidenceError: 'No pudimos cargar las evidencias de esta tarea.',
    };
  }
}

export async function updateStaffTaskStatus(user: User, input: UpdateStaffTaskStatusInput): Promise<TaskEntity> {
  const updated = await tasksRepo.updateStatusForUser(user, input.taskId, input.status);
  if (!updated) throw new Error('No pudimos actualizar la tarea.');
  return updated;
}

export async function createStaffTaskExecution(user: User, input: CreateStaffTaskExecutionInput): Promise<ChecklistExecution> {
  return checklistExecutionsRepo.createForTask(user, { taskId: input.taskId, templateId: input.templateId });
}

export async function saveStaffTaskChecklist(user: User, input: SaveStaffChecklistInput): Promise<ChecklistExecution> {
  const updated = await checklistExecutionsRepo.saveResultsForUser(user, input.executionId, input.results);
  if (!updated) throw new Error('No pudimos guardar el checklist.');
  return updated;
}

export async function completeStaffTaskChecklist(user: User, input: SaveStaffChecklistInput): Promise<ChecklistExecution> {
  const updated = await checklistExecutionsRepo.completeForUser(user, input.executionId, input.results);
  if (!updated) throw new Error('No pudimos completar el checklist.');
  return updated;
}

export async function uploadStaffTaskEvidence(user: User, input: UploadStaffEvidenceInput): Promise<EvidenceAttachment> {
  return evidenceRepo.uploadForChecklistExecution(user, {
    checklistExecutionId: input.checklistExecutionId,
    file: input.file,
  });
}

export async function deleteStaffTaskEvidence(user: User, evidenceId: string): Promise<void> {
  await evidenceRepo.deleteForUser(user, evidenceId);
}
