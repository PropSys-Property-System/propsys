import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE as deleteEvidence, GET as getEvidence } from './evidence/[id]/route';

const poolQuery = vi.fn();
const clientQuery = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query: clientQuery, release }));

const storageMocks = vi.hoisted(() => ({
  deleteEvidenceFile: vi.fn(),
  readEvidenceFile: vi.fn(),
}));

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query: poolQuery,
    connect,
  }),
}));

vi.mock('@/lib/server/operation/evidence-storage', () => ({
  deleteEvidenceFile: storageMocks.deleteEvidenceFile,
  readEvidenceFile: storageMocks.readEvidenceFile,
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

function evidenceRow(
  overrides: Partial<{
    checklist_execution_id: string | null;
    file_name: string;
    mime_type: string;
    public_path: string | null;
    storage_path: string | null;
    url: string | null;
    uploaded_by_user_id: string;
  }> = {}
) {
  return {
    id: 'ev_1',
    client_id: 'client_001',
    building_id: 'b1',
    checklist_execution_id: 'chk-exec-1',
    file_name: 'evidencia.jpg',
    mime_type: 'image/jpeg',
    public_path: '/api/v1/operation/evidence/ev_1',
    storage_path: '.data/uploads/evidence/chk-exec-1/ev_1.jpg',
    url: '/api/v1/operation/evidence/ev_1',
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
    storageMocks.readEvidenceFile.mockReset();
    sessionUser.id = 'u_staff';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'STAFF';
    sessionUser.scope = 'client';
  });

  it('streams evidence through the authenticated route for assigned STAFF', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM evidence_attachments')) return { rows: [evidenceRow()] };
      if (sql.includes('FROM checklist_executions')) return { rows: [execRow()] };
      return { rows: [] };
    });
    storageMocks.readEvidenceFile.mockResolvedValue(Buffer.from([1, 2, 3]));

    const req = new Request('http://localhost/api/v1/operation/evidence/ev_1', { method: 'GET' });
    const res = await getEvidence(req, { params: Promise.resolve({ id: 'ev_1' }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(storageMocks.readEvidenceFile).toHaveBeenCalledWith('.data/uploads/evidence/chk-exec-1/ev_1.jpg');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('does not read the file when STAFF requests evidence from another assignee', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM evidence_attachments')) {
        return { rows: [evidenceRow({ uploaded_by_user_id: 'u_other' })] };
      }
      if (sql.includes('FROM checklist_executions')) {
        return { rows: [execRow({ assigned_to_user_id: 'u_other' })] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/evidence/ev_1', { method: 'GET' });
    const res = await getEvidence(req, { params: Promise.resolve({ id: 'ev_1' }) });

    expect(res.status).toBe(403);
    expect(storageMocks.readEvidenceFile).not.toHaveBeenCalled();
  });

  it('serves legacy evidence records through authorization when only public_path is populated', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM evidence_attachments')) {
        return {
          rows: [
            evidenceRow({
              public_path: '/uploads/evidence/chk-exec-1/ev_legacy.jpg',
              storage_path: null,
              url: '/uploads/evidence/chk-exec-1/ev_legacy.jpg',
            }),
          ],
        };
      }
      if (sql.includes('FROM checklist_executions')) return { rows: [execRow()] };
      return { rows: [] };
    });
    storageMocks.readEvidenceFile.mockResolvedValue(Buffer.from([4, 5, 6]));

    const req = new Request('http://localhost/api/v1/operation/evidence/ev_1', { method: 'GET' });
    const res = await getEvidence(req, { params: Promise.resolve({ id: 'ev_1' }) });

    expect(res.status).toBe(200);
    expect(storageMocks.readEvidenceFile).toHaveBeenCalledWith('/uploads/evidence/chk-exec-1/ev_legacy.jpg');
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
