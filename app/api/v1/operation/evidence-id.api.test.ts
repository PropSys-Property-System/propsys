import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE as deleteEvidence } from './evidence/[id]/route';

const poolQuery = vi.fn();
const clientQuery = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query: clientQuery, release }));

const storageMocks = vi.hoisted(() => ({
  deleteEvidenceFile: vi.fn(),
}));

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query: poolQuery,
    connect,
  }),
}));

vi.mock('@/lib/server/operation/evidence-storage', () => ({
  deleteEvidenceFile: storageMocks.deleteEvidenceFile,
}));

const sessionUser = {
  id: 'u_staff',
  clientId: 'client_001' as string | null,
  email: 'staff@propsys.com',
  name: 'Staff Operativo',
  role: 'STAFF',
  internalRole: 'STAFF' as string,
  scope: 'client' as string,
  status: 'ACTIVE' as string,
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

function evidenceRow(overrides: Partial<{ uploaded_by_user_id: string; storage_path: string | null }> = {}) {
  return {
    id: 'ev_1',
    client_id: 'client_001',
    building_id: 'b1',
    checklist_execution_id: 'chk-exec-1',
    storage_path: 'public/uploads/evidence/chk-exec-1/ev_1.jpg',
    uploaded_by_user_id: 'u_staff',
    deleted_at: null,
    ...overrides,
  };
}

function execRow(overrides: Partial<{ status: string; assigned_to_user_id: string }> = {}) {
  return {
    id: 'chk-exec-1',
    assigned_to_user_id: 'u_staff',
    status: 'IN_PROGRESS',
    building_id: 'b1',
    ...overrides,
  };
}

describe('evidence DELETE /[id] (audit regression)', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    connect.mockClear();
    storageMocks.deleteEvidenceFile.mockReset();
    sessionUser.id = 'u_staff';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'STAFF';
    sessionUser.scope = 'client';
  });

  it('soft-deletes evidence and records audit log (STAFF)', async () => {
    let auditParams: unknown[] | null = null;

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM evidence_attachments')) return { rows: [evidenceRow()] };
      if (sql.includes('FROM checklist_executions')) return { rows: [execRow()] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE evidence_attachments')) return { rows: [] };
      if (sql.includes('INSERT INTO audit_logs')) {
        auditParams = params ?? null;
        return { rows: [] };
      }
      return { rows: [] };
    });

    storageMocks.deleteEvidenceFile.mockResolvedValue(undefined);

    const req = new Request('http://localhost/api/v1/operation/evidence/ev_1', { method: 'DELETE' });
    const res = await deleteEvidence(req, { params: Promise.resolve({ id: 'ev_1' }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
    expect(auditParams?.[3]).toBe('DELETE');
    expect(auditParams?.[4]).toBe('EvidenceAttachment');
  });

  it('returns 500 when audit log insert fails during evidence deletion (no silent swallow)', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM evidence_attachments')) return { rows: [evidenceRow()] };
      if (sql.includes('FROM checklist_executions')) return { rows: [execRow()] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql.includes('UPDATE evidence_attachments')) return { rows: [] };
      if (sql.includes('INSERT INTO audit_logs')) throw new Error('audit down');
      if (sql === 'ROLLBACK') return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/evidence/ev_1', { method: 'DELETE' });
    const res = await deleteEvidence(req, { params: Promise.resolve({ id: 'ev_1' }) });
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('No pudimos registrar la auditoría.');
  });

  it('returns 403 when OWNER attempts to delete evidence', async () => {
    sessionUser.internalRole = 'OWNER';

    const req = new Request('http://localhost/api/v1/operation/evidence/ev_1', { method: 'DELETE' });
    const res = await deleteEvidence(req, { params: Promise.resolve({ id: 'ev_1' }) });
    expect(res.status).toBe(403);
    expect(connect).not.toHaveBeenCalled();
  });
});
