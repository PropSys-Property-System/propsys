import { describe, expect, it, vi } from 'vitest';
import { POST as createExecution, GET as listExecutions } from './checklist-executions/route';
import { PATCH as patchExecution } from './checklist-executions/[id]/route';
import { POST as addEvidence } from './evidence/route';
import { DELETE as deleteEvidence } from './evidence/[id]/route';

const storageMocks = vi.hoisted(() => ({
  saveEvidenceFile: vi.fn(),
  deleteEvidenceFile: vi.fn(),
  isAllowedEvidence: vi.fn(() => true),
}));

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

vi.mock('@/lib/server/operation/evidence-storage', () => ({
  MAX_EVIDENCE_BYTES: 10 * 1024 * 1024,
  saveEvidenceFile: storageMocks.saveEvidenceFile,
  deleteEvidenceFile: storageMocks.deleteEvidenceFile,
  isAllowedEvidence: storageMocks.isAllowedEvidence,
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

  it('returns an approved checklist to staff and reopens the task', async () => {
    query.mockReset();

    (sessionUser as unknown as { internalRole: string }).internalRole = 'BUILDING_ADMIN';
    (sessionUser as unknown as { id: string }).id = 'u2';

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
              status: 'APPROVED',
              results: [{ itemId: 'req-1', value: true }],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              approved_at: new Date().toISOString(),
              last_review_action: 'APPROVE',
              review_comment: null,
              reviewed_at: new Date().toISOString(),
              reviewed_by_user_id: 'u2',
              deleted_at: null,
            },
          ],
        };
      }
      if (sql.includes('FROM user_building_assignments')) return { rows: [{ ok: true }] };
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
              status: 'PENDING',
              results: [{ itemId: 'req-1', value: true }],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              completed_at: null,
              approved_at: null,
              last_review_action: 'RETURN',
              review_comment: 'Falta una foto del tablero electrico.',
              reviewed_at: new Date().toISOString(),
              reviewed_by_user_id: 'u2',
              deleted_at: null,
            },
          ],
        };
      }
      if (sql.startsWith('UPDATE tasks')) return { rows: [{ id: 'task-qa-1' }] };
      if (sql.startsWith('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/checklist-executions/chkexec_test', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'RETURN', comment: 'Falta una foto del tablero electrico.' }),
    });
    const res = await patchExecution(req, { params: Promise.resolve({ id: 'chkexec_test' }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { execution: { status: string; approvedAt?: string; lastReviewAction?: string; reviewComment?: string } };
    expect(data.execution.status).toBe('PENDING');
    expect(data.execution.approvedAt).toBeUndefined();
    expect(data.execution.lastReviewAction).toBe('RETURN');
    expect(data.execution.reviewComment).toBe('Falta una foto del tablero electrico.');

    (sessionUser as unknown as { internalRole: string }).internalRole = 'STAFF';
    (sessionUser as unknown as { id: string }).id = 'u3';
  });

  it('preserves return feedback when STAFF saves progress after a return', async () => {
    query.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'STAFF';
    (sessionUser as unknown as { id: string }).id = 'u3';

    const reviewedAt = new Date().toISOString();

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
              results: [{ itemId: 'req-1', value: true }],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              completed_at: null,
              approved_at: null,
              last_review_action: 'RETURN',
              review_comment: 'Falta una foto del tablero electrico.',
              reviewed_at: reviewedAt,
              reviewed_by_user_id: 'u2',
              deleted_at: null,
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
              status: 'PENDING',
              results: [{ itemId: 'req-1', value: true }],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              completed_at: null,
              approved_at: null,
              last_review_action: 'RETURN',
              review_comment: 'Falta una foto del tablero electrico.',
              reviewed_at: reviewedAt,
              reviewed_by_user_id: 'u2',
              deleted_at: null,
            },
          ],
        };
      }
      if (sql.startsWith('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/checklist-executions/chkexec_test', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'SAVE', results: [{ itemId: 'req-1', value: true }] }),
    });
    const res = await patchExecution(req, { params: Promise.resolve({ id: 'chkexec_test' }) });
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      execution: { lastReviewAction?: string; reviewComment?: string; reviewedAt?: string; reviewedByUserId?: string };
    };
    expect(data.execution.lastReviewAction).toBe('RETURN');
    expect(data.execution.reviewComment).toBe('Falta una foto del tablero electrico.');
    expect(data.execution.reviewedAt).toBe(reviewedAt);
    expect(data.execution.reviewedByUserId).toBe('u2');

    const updateCall = query.mock.calls.find(
      ([sql]) => typeof sql === 'string' && (sql as string).startsWith('UPDATE checklist_executions')
    );
    const params = updateCall?.[1] as unknown[];
    expect(params?.[4]).toBe('RETURN');
    expect(params?.[5]).toBe('Falta una foto del tablero electrico.');
    expect(params?.[6]).toBe(reviewedAt);
    expect(params?.[7]).toBe('u2');
  });

  it('clears return feedback when STAFF completes the corrected checklist', async () => {
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
              results: [{ itemId: 'req-1', value: false }],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              completed_at: null,
              approved_at: null,
              last_review_action: 'RETURN',
              review_comment: 'Corrige y vuelve a enviar.',
              reviewed_at: new Date().toISOString(),
              reviewed_by_user_id: 'u2',
              deleted_at: null,
            },
          ],
        };
      }
      if (sql.includes('FROM checklist_templates')) {
        return {
          rows: [
            {
              items: [{ id: 'req-1', label: 'Req 1', required: true }],
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
              last_review_action: null,
              review_comment: null,
              reviewed_at: null,
              reviewed_by_user_id: null,
              deleted_at: null,
            },
          ],
        };
      }
      if (sql.startsWith('UPDATE tasks')) return { rows: [{ id: 'task-qa-1' }] };
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

    const data = (await res.json()) as { execution: { status: string; lastReviewAction?: string; reviewComment?: string } };
    expect(data.execution.status).toBe('COMPLETED');
    expect(data.execution.lastReviewAction).toBeUndefined();
    expect(data.execution.reviewComment).toBeUndefined();

    const updateCall = query.mock.calls.find(
      ([sql]) => typeof sql === 'string' && (sql as string).startsWith('UPDATE checklist_executions')
    );
    const params = updateCall?.[1] as unknown[];
    expect(params?.[4]).toBeNull();
    expect(params?.[5]).toBeNull();
    expect(params?.[6]).toBeNull();
    expect(params?.[7]).toBeNull();
  });

  it('adds evidence for a checklist execution (STAFF)', async () => {
    query.mockReset();
    storageMocks.saveEvidenceFile.mockReset();
    storageMocks.deleteEvidenceFile.mockReset();
    storageMocks.isAllowedEvidence.mockReset();
    storageMocks.isAllowedEvidence.mockReturnValue(true);
    storageMocks.saveEvidenceFile.mockResolvedValue({
      originalName: 'evidencia.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 4,
      storagePath: 'public/uploads/evidence/chkexec_test/ev_test.jpg',
      publicPath: '/uploads/evidence/chkexec_test/ev_test.jpg',
    });

    query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM checklist_executions')) {
        return {
          rows: [
            {
              id: 'chkexec_test',
              client_id: 'client_001',
              building_id: 'b1',
              task_id: 'task-qa-1',
              assigned_to_user_id: 'u3',
              status: 'PENDING',
            },
          ],
        };
      }
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
              file_name: 'evidencia.jpg',
              mime_type: 'image/jpeg',
              size_bytes: 4,
              storage_path: 'public/uploads/evidence/chkexec_test/ev_test.jpg',
              public_path: '/uploads/evidence/chkexec_test/ev_test.jpg',
              url: '/uploads/evidence/chkexec_test/ev_test.jpg',
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

    const form = new FormData();
    form.set('checklistExecutionId', 'chkexec_test');
    form.set('file', new File([new Uint8Array([1, 2, 3, 4])], 'evidencia.jpg', { type: 'image/jpeg' }));

    const req = new Request('http://localhost/api/v1/operation/evidence', { method: 'POST', body: form });
    Object.defineProperty(req, 'formData', { value: async () => form });
    const res = await addEvidence(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { evidence: { url: string } };
    expect(data.evidence.url).toBe('/uploads/evidence/chkexec_test/ev_test.jpg');
    const auditCalls = query.mock.calls.filter(([sql]) => typeof sql === 'string' && (sql as string).startsWith('INSERT INTO audit_logs'));
    expect(auditCalls.length).toBe(1);
  });

  it('rejects link-based evidence payloads', async () => {
    query.mockReset();
    const req = new Request('http://localhost/api/v1/operation/evidence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checklistExecutionId: 'chkexec_test', url: 'https://example.com/file.pdf' }),
    });
    const res = await addEvidence(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Adjunta una foto o un archivo PDF como evidencia.');
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
