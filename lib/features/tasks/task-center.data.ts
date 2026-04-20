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

export async function loadStaffTasksPageData(user: User): Promise<StaffTasksPageData> {
  const [tasks, buildings] = await Promise.all([tasksRepo.listForUser(user), buildingsRepo.listForUser(user)]);

  return {
    tasks,
    buildingNameById: Object.fromEntries(buildings.map((building) => [building.id, building.name])),
  };
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
