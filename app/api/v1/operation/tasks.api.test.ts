import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as createTask } from './tasks/route';
import { PATCH as updateTask } from './tasks/[id]/route';

const poolQuery = vi.fn();
const clientQuery = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query: clientQuery, release }));

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query: poolQuery,
    connect,
  }),
}));

const sessionUser = {
  id: 'u_badmin',
  clientId: 'client_001' as string | null,
  email: 'badmin@propsys.com',
  name: 'Building Admin',
  role: 'MANAGER',
  internalRole: 'BUILDING_ADMIN' as string,
  scope: 'client' as string,
  status: 'ACTIVE' as string,
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

function taskRow(overrides: Partial<{ id: string; client_id: string; building_id: string; status: string; assigned_to_user_id: string; checklist_template_id: string | null }> = {}) {
  return {
    id: 'task_1',
    client_id: 'client_001',
    building_id: 'b1',
    checklist_template_id: null,
    assigned_to_user_id: 'u_staff',
    created_by_user_id: 'u_badmin',
    title: 'Tarea de prueba',
    description: null,
    status: 'PENDING',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('tasks API (route handlers)', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    connect.mockClear();
    sessionUser.id = 'u_badmin';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'BUILDING_ADMIN';
    sessionUser.scope = 'client';
  });

  it('creates a simple task and records audit log (BUILDING_ADMIN)', async () => {
    let auditParams: unknown[] | null = null;

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT client_id FROM buildings')) return { rows: [{ client_id: 'client_001' }] };
      if (sql.includes('FROM user_building_assignments') && sql.includes('user_id = $1') && sql.includes('building_id = $2') && !sql.includes('u.id')) {
        return { rows: [{ ok: true }] };
      }
      if (sql.includes('FROM users u') && sql.includes('JOIN user_building_assignments')) return { rows: [{ ok: true }] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO tasks')) return { rows: [taskRow()] };
      if (sql.includes('INSERT INTO audit_logs')) {
        auditParams = params ?? null;
        return { rows: [] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b1', assignedToUserId: 'u_staff', title: 'Tarea de prueba' }),
    });

    const res = await createTask(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { task?: { id: string; status: string } };
    expect(data.task?.status).toBe('PENDING');
    expect(auditParams?.[3]).toBe('CREATE');
    expect(auditParams?.[4]).toBe('Task');
  });

  it('returns 403 when STAFF attempts to create a task', async () => {
    sessionUser.internalRole = 'STAFF';

    const req = new Request('http://localhost/api/v1/operation/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b1', assignedToUserId: 'u_staff', title: 'Tarea ilegal' }),
    });

    const res = await createTask(req);
    expect(res.status).toBe(403);
    expect(connect).not.toHaveBeenCalled();
  });

  it('returns 400 for missing required fields (no title)', async () => {
    const req = new Request('http://localhost/api/v1/operation/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b1', assignedToUserId: 'u_staff' }),
    });

    const res = await createTask(req);
    expect(res.status).toBe(400);
    expect(connect).not.toHaveBeenCalled();
  });

  it('returns 500 when audit log insert fails during task creation (no silent swallow)', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT client_id FROM buildings')) return { rows: [{ client_id: 'client_001' }] };
      if (sql.includes('FROM user_building_assignments') && sql.includes('user_id = $1') && sql.includes('building_id = $2') && !sql.includes('u.id')) {
        return { rows: [{ ok: true }] };
      }
      if (sql.includes('FROM users u') && sql.includes('JOIN user_building_assignments')) return { rows: [{ ok: true }] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql.includes('INSERT INTO tasks')) return { rows: [taskRow()] };
      if (sql.includes('INSERT INTO audit_logs')) throw new Error('audit down');
      if (sql === 'ROLLBACK') return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b1', assignedToUserId: 'u_staff', title: 'Tarea de prueba' }),
    });

    const res = await createTask(req);
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('No pudimos registrar la auditoría.');
  });

  it('updates task status and records audit log (STAFF moves to IN_PROGRESS)', async () => {
    sessionUser.internalRole = 'STAFF';
    sessionUser.id = 'u_staff';

    let auditParams: unknown[] | null = null;

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM tasks') && sql.includes('WHERE id = $1')) {
        return { rows: [taskRow({ assigned_to_user_id: 'u_staff', status: 'PENDING', checklist_template_id: null })] };
      }
      if (sql.includes('FROM user_building_assignments')) return { rows: [{ ok: true }] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE tasks')) return { rows: [taskRow({ status: 'IN_PROGRESS' })] };
      if (sql.includes('INSERT INTO audit_logs')) {
        auditParams = params ?? null;
        return { rows: [] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/tasks/task_1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });

    const res = await updateTask(req, { params: Promise.resolve({ id: 'task_1' }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { task?: { status: string } };
    expect(data.task?.status).toBe('IN_PROGRESS');
    expect(auditParams?.[3]).toBe('UPDATE');
    expect(auditParams?.[4]).toBe('Task');
  });

  it('returns 500 when audit log insert fails during task update (no silent swallow)', async () => {
    sessionUser.internalRole = 'STAFF';
    sessionUser.id = 'u_staff';

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM tasks') && sql.includes('WHERE id = $1')) {
        return { rows: [taskRow({ assigned_to_user_id: 'u_staff', status: 'PENDING', checklist_template_id: null })] };
      }
      if (sql.includes('FROM user_building_assignments')) return { rows: [{ ok: true }] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql.includes('UPDATE tasks')) return { rows: [taskRow({ status: 'IN_PROGRESS' })] };
      if (sql.includes('INSERT INTO audit_logs')) throw new Error('audit down');
      if (sql === 'ROLLBACK') return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/tasks/task_1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });

    const res = await updateTask(req, { params: Promise.resolve({ id: 'task_1' }) });
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('No pudimos registrar la auditoría.');
  });
});
