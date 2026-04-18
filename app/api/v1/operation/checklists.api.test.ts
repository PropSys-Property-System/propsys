import { describe, expect, it, vi } from 'vitest';
import { POST as createExecution, GET as listExecutions } from './checklist-executions/route';
import { PATCH as patchExecution } from './checklist-executions/[id]/route';
import { POST as addEvidence } from './evidence/route';
import { DELETE as deleteEvidence } from './evidence/[id]/route';

const query = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query, release }));

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query,
    connect,
  }),
}));

const sessionUser = {
  id: 'u3',
  clientId: 'client_001',
  email: 'staff@propsys.com',
  name: 'Staff',
  role: 'STAFF',
  internalRole: 'STAFF',
  scope: 'client',
  status: 'ACTIVE',
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

describe('operation checklists API (route handlers)', () => {
  it('denies creating checklist execution for non-STAFF', async () => {
    query.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'BUILDING_ADMIN';

    const req = new Request('http://localhost/api/v1/operation/checklist-executions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ templateId: 'chk-tpl-qa-b1', taskId: 'task-qa-1' }),
    });
    const res = await createExecution(req);
    expect(res.status).toBe(403);
    (sessionUser as unknown as { internalRole: string }).internalRole = 'STAFF';
  });

  it('creates a checklist execution and writes audit log', async () => {
    query.mockReset();

    query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM checklist_templates')) return { rows: [{ client_id: 'client_001', building_id: 'b1' }] };
      if (sql.includes('FROM user_building_assignments')) return { rows: [{ ok: true }] };
      if (sql.includes('FROM tasks')) return { rows: [{ id: 'task-qa-1' }] };
      if (sql.startsWith('INSERT INTO checklist_executions')) {
        return {
          rows: [
            {
              id: 'chkexec_test',
              client_id: 'client_001',
              building_id: 'b1',
              unit_id: null,
              task_id: 'task-qa-1',
              template_id: 'chk-tpl-qa-b1',
              assigned_to_user_id: 'u3',
              status: 'PENDING',
              results: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              completed_at: null,
              approved_at: null,
              deleted_at: null,
            },
          ],
        };
      }
      if (sql.startsWith('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/checklist-executions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ templateId: 'chk-tpl-qa-b1', taskId: 'task-qa-1' }),
    });

    const res = await createExecution(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { execution: { status: string } };
    expect(data.execution.status).toBe('PENDING');
    const auditCalls = query.mock.calls.filter(([sql]) => typeof sql === 'string' && (sql as string).startsWith('INSERT INTO audit_logs'));
    expect(auditCalls.length).toBe(1);
  });

  it('lists executions for STAFF (scoped by assignee)', async () => {
    query.mockReset();
    query.mockResolvedValueOnce({ rows: [{ building_id: 'b1' }] });
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'chkexec_1',
          client_id: 'client_001',
          building_id: 'b1',
          unit_id: null,
          task_id: 'task-qa-1',
          template_id: 'chk-tpl-qa-b1',
          assigned_to_user_id: 'u3',
          status: 'PENDING',
          results: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          completed_at: null,
          approved_at: null,
          deleted_at: null,
        },
      ],
    });

    const req = new Request('http://localhost/api/v1/operation/checklist-executions', { method: 'GET' });
    const res = await listExecutions(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { executions: Array<{ assignedToUserId: string }> };
    expect(data.executions[0]?.assignedToUserId).toBe('u3');
  });

  it('rejects COMPLETE when a required item is not checked', async () => {
    query.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'STAFF';
    (sessionUser as unknown as { id: string }).id = 'u3';

    query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM checklist_executions')) {
        return {
          rows: [
            {
              id: 'chkexec_test',
              client_id: 'client_001',
              building_id: 'b1',
              unit_id: null,
              task_id: 'task-qa-1',
              template_id: 'chk-tpl-qa-b1',
              assigned_to_user_id: 'u3',
              status: 'PENDING',
              results: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              completed_at: null,
              approved_at: null,
              deleted_at: null,
            },
          ],
        };
      }
      if (sql.includes('FROM checklist_templates')) {
        return {
          rows: [
            {
              items: [
                { id: 'req-1', label: 'Req 1', required: true },
                { id: 'opt-1', label: 'Opt 1', required: false },
              ],
            },
          ],
        };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/checklist-executions/chkexec_test', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'COMPLETE', results: [{ itemId: 'req-1', value: false }] }),
    });
    const res = await patchExecution(req, { params: Promise.resolve({ id: 'chkexec_test' }) });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Marca todos los items requeridos para completar el checklist.');
  });

  it('allows COMPLETE when all required items are checked (optional may be unchecked)', async () => {
    query.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'STAFF';
    (sessionUser as unknown as { id: string }).id = 'u3';

    query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM checklist_executions')) {
        return {
          rows: [
            {
              id: 'chkexec_test',
              client_id: 'client_001',
              building_id: 'b1',
              unit_id: null,
              task_id: 'task-qa-1',
              template_id: 'chk-tpl-qa-b1',
              assigned_to_user_id: 'u3',
              status: 'PENDING',
              results: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              completed_at: null,
              approved_at: null,
              deleted_at: null,
            },
          ],
        };
      }
      if (sql.includes('FROM checklist_templates')) {
        return {
          rows: [
            {
              items: [
                { id: 'req-1', label: 'Req 1', required: true },
                { id: 'opt-1', label: 'Opt 1', required: false },
              ],
            },
          ],
        };
      }
      if (sql.startsWith('UPDATE checklist_executions')) {
        return {
          rows: [
            {
              id: 'chkexec_test',
              client_id: 'client_001',
              building_id: 'b1',
              unit_id: null,
              task_id: 'task-qa-1',
              template_id: 'chk-tpl-qa-b1',
              assigned_to_user_id: 'u3',
              status: 'COMPLETED',
              results: [{ itemId: 'req-1', value: true }],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              approved_at: null,
              deleted_at: null,
            },
          ],
        };
      }
      if (sql.startsWith('UPDATE tasks')) return { rows: [] };
      if (sql.startsWith('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/checklist-executions/chkexec_test', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'COMPLETE', results: [{ itemId: 'req-1', value: true }] }),
    });
    const res = await patchExecution(req, { params: Promise.resolve({ id: 'chkexec_test' }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { execution: { status: string } };
    expect(data.execution.status).toBe('COMPLETED');
  });

  it('denies approving without building assignment', async () => {
    query.mockReset();

    (sessionUser as unknown as { internalRole: string }).internalRole = 'BUILDING_ADMIN';
    (sessionUser as unknown as { id: string }).id = 'u2';

    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'chkexec_test',
          client_id: 'client_001',
          building_id: 'b1',
          unit_id: null,
          task_id: 'task-qa-1',
          template_id: 'chk-tpl-qa-b1',
          assigned_to_user_id: 'u3',
          status: 'COMPLETED',
          results: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          approved_at: null,
          deleted_at: null,
        },
      ],
    });
    query.mockResolvedValueOnce({ rows: [] });

    const req = new Request('http://localhost/api/v1/operation/checklist-executions/chkexec_test', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'APPROVE' }),
    });
    const res = await patchExecution(req, { params: Promise.resolve({ id: 'chkexec_test' }) });
    expect(res.status).toBe(403);

    (sessionUser as unknown as { internalRole: string }).internalRole = 'STAFF';
    (sessionUser as unknown as { id: string }).id = 'u3';
  });

  it('adds evidence for a checklist execution (STAFF)', async () => {
    query.mockReset();

    query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM checklist_executions')) return { rows: [{ id: 'chkexec_test', client_id: 'client_001', building_id: 'b1', task_id: 'task-qa-1', assigned_to_user_id: 'u3' }] };
      if (sql.startsWith('INSERT INTO evidence_attachments')) {
        return {
          rows: [
            {
              id: 'ev_test',
              client_id: 'client_001',
              building_id: 'b1',
              unit_id: null,
              incident_id: null,
              task_id: 'task-qa-1',
              checklist_execution_id: 'chkexec_test',
              file_name: 'evidence-link',
              mime_type: 'text/uri-list',
              url: 'https://example.com/x',
              uploaded_by_user_id: 'u3',
              created_at: new Date().toISOString(),
              deleted_at: null,
            },
          ],
        };
      }
      if (sql.startsWith('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/evidence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checklistExecutionId: 'chkexec_test', url: 'https://example.com/x' }),
    });
    const res = await addEvidence(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { evidence: { url: string } };
    expect(data.evidence.url).toBe('https://example.com/x');
    const auditCalls = query.mock.calls.filter(([sql]) => typeof sql === 'string' && (sql as string).startsWith('INSERT INTO audit_logs'));
    expect(auditCalls.length).toBe(1);
  });

  it('rejects multipart evidence uploads in V1', async () => {
    query.mockReset();

    const form = new FormData();
    form.set('checklistExecutionId', 'chkexec_test');
    form.set('file', new File(['demo'], 'evidence.pdf', { type: 'application/pdf' }));

    const req = new Request('http://localhost/api/v1/operation/evidence', {
      method: 'POST',
      body: form,
    });
    const res = await addEvidence(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('V1 solo admite evidencias como enlaces URL.');
  });

  it('soft-deletes evidence and writes audit log', async () => {
    query.mockReset();

    query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM evidence_attachments')) {
        return {
          rows: [
            {
              id: 'ev_test',
              client_id: 'client_001',
              building_id: 'b1',
              checklist_execution_id: 'chkexec_test',
              uploaded_by_user_id: 'u3',
              deleted_at: null,
            },
          ],
        };
      }
      if (sql.includes('FROM checklist_executions')) {
        return {
          rows: [
            {
              id: 'chkexec_test',
              assigned_to_user_id: 'u3',
              status: 'PENDING',
              building_id: 'b1',
            },
          ],
        };
      }
      if (sql.includes('FROM user_building_assignments')) return { rows: [{ ok: true }] };
      if (sql.startsWith('UPDATE evidence_attachments')) return { rows: [] };
      if (sql.startsWith('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/evidence/ev_test', {
      method: 'DELETE',
    });
    const res = await deleteEvidence(req, { params: Promise.resolve({ id: 'ev_test' }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
    const auditCalls = query.mock.calls.filter(([sql]) => typeof sql === 'string' && (sql as string).startsWith('INSERT INTO audit_logs'));
    expect(auditCalls.length).toBe(1);
  });
});
