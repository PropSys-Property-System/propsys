import { beforeEach, describe, expect, it } from 'vitest';
import { tasksRepo } from '@/lib/repos/operation/tasks.repo';
import { MOCK_CHECKLIST_TEMPLATES, MOCK_TASKS_V1 } from '@/lib/mocks';
import type { User } from '@/lib/types';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const initialTasks = clone(MOCK_TASKS_V1);
const initialTemplates = clone(MOCK_CHECKLIST_TEMPLATES);

function resetArray<T>(target: T[], snapshot: T[]) {
  target.splice(0, target.length, ...clone(snapshot));
}

function userBase(overrides: Partial<User>): User {
  return {
    id: 'u_test',
    email: 'test@propsys.local',
    name: 'Test',
    role: 'MANAGER',
    internalRole: 'CLIENT_MANAGER',
    clientId: 'client_001',
    scope: 'client',
    status: 'ACTIVE',
    ...overrides,
  };
}

beforeEach(() => {
  resetArray(MOCK_TASKS_V1, initialTasks);
  resetArray(MOCK_CHECKLIST_TEMPLATES, initialTemplates);
});

describe('tasksRepo', () => {
  it('allows STAFF to move a simple task from PENDING to IN_PROGRESS', async () => {
    const staff = userBase({ id: 'u3', internalRole: 'STAFF', role: 'STAFF' });

    const updated = await tasksRepo.updateStatusForUser(staff, 'task-1', 'IN_PROGRESS');

    expect(updated?.status).toBe('IN_PROGRESS');
    expect(MOCK_TASKS_V1.find((task) => task.id === 'task-1')?.status).toBe('IN_PROGRESS');
  });

  it('prevents STAFF from manually completing a task that is governed by a checklist', async () => {
    const staff = userBase({ id: 'u3', internalRole: 'STAFF', role: 'STAFF' });
    const task = MOCK_TASKS_V1.find((item) => item.id === 'task-1');
    if (!task) throw new Error('task-1 not found');
    task.checklistTemplateId = 'chk-tpl-1';
    task.status = 'IN_PROGRESS';

    await expect(tasksRepo.updateStatusForUser(staff, 'task-1', 'COMPLETED')).rejects.toThrow(
      'La tarea se marca como completada al completar el checklist.'
    );
  });

  it('allows CLIENT_MANAGER to reassign a task inside the tenant', async () => {
    const manager = userBase({ id: 'u1', internalRole: 'CLIENT_MANAGER', role: 'MANAGER' });

    const updated = await tasksRepo.updateForUser(manager, 'task-2', { assignedToUserId: 'u2' });

    expect(updated?.assignedToUserId).toBe('u2');
    expect(MOCK_TASKS_V1.find((task) => task.id === 'task-2')?.assignedToUserId).toBe('u2');
  });
});
