import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './evidence/route';

const poolQuery = vi.fn();
const clientQuery = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query: clientQuery, release }));
const storageMocks = vi.hoisted(() => ({
  saveEvidenceFile: vi.fn(),
  deleteEvidenceFile: vi.fn(),
  isAllowedEvidence: vi.fn(() => true),
}));

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query: poolQuery,
    connect,
  }),
}));

const sessionUser = {
  id: 'u_staff',
  clientId: 'client_001' as string | null,
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

describe('evidence API', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    connect.mockClear();
    storageMocks.saveEvidenceFile.mockReset();
    storageMocks.deleteEvidenceFile.mockReset();
    storageMocks.isAllowedEvidence.mockReset();
    storageMocks.isAllowedEvidence.mockReturnValue(true);
    sessionUser.id = 'u_staff';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'STAFF';
    sessionUser.scope = 'client';
  });

  function evidenceRow(overrides: Partial<{ id: string; checklist_execution_id: string; uploaded_by_user_id: string }> = {}) {
    return {
      id: 'ev_own',
      client_id: 'client_001',
      building_id: 'b1',
      unit_id: null,
      incident_id: null,
      task_id: 'task-1',
      checklist_execution_id: 'chk-exec-1',
      file_name: 'evidencia.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 4,
      storage_path: '.data/uploads/evidence/chk-exec-1/ev_own.jpg',
      public_path: '/uploads/evidence/chk-exec-1/ev_own.jpg',
      url: '/uploads/evidence/chk-exec-1/ev_own.jpg',
      uploaded_by_user_id: 'u_staff',
      created_at: new Date().toISOString(),
      deleted_at: null,
      ...overrides,
    };
  }

  it('limits general evidence listing for STAFF to assigned checklist executions', async () => {
    let evidenceSql = '';
    let evidenceParams: unknown[] = [];

    poolQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM user_building_assignments')) {
        return { rows: [{ building_id: 'b1' }] };
      }
      if (sql.includes('FROM evidence_attachments')) {
        evidenceSql = sql;
        evidenceParams = params;
        return {
          rows: sql.includes('assigned_to_user_id = $3')
            ? [evidenceRow()]
            : [evidenceRow(), evidenceRow({ id: 'ev_other', checklist_execution_id: 'chk-exec-2', uploaded_by_user_id: 'u_other' })],
        };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/evidence', { method: 'GET' });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = (await res.json()) as { evidence: Array<{ id: string; url: string }> };
    expect(data.evidence.map((item) => item.id)).toEqual(['ev_own']);
    expect(data.evidence[0]).toMatchObject({ url: '/api/v1/operation/evidence/ev_own' });
    expect(evidenceSql).toContain('FROM checklist_executions ce');
    expect(evidenceSql).toContain('assigned_to_user_id = $3');
    expect(evidenceParams[0]).toBe('client_001');
    expect(evidenceParams[1]).toEqual(['b1']);
    expect(evidenceParams[2]).toBe('u_staff');
  });

  it('keeps building admin general evidence listing available for assigned buildings', async () => {
    sessionUser.internalRole = 'BUILDING_ADMIN';
    let evidenceSql = '';

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM user_building_assignments')) {
        return { rows: [{ building_id: 'b1' }] };
      }
      if (sql.includes('FROM evidence_attachments')) {
        evidenceSql = sql;
        return { rows: [evidenceRow({ id: 'ev_admin' })] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/evidence', { method: 'GET' });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = (await res.json()) as { evidence: Array<{ id: string; url: string }> };
    expect(data.evidence.map((item) => item.id)).toEqual(['ev_admin']);
    expect(data.evidence[0].url).toBe('/api/v1/operation/evidence/ev_admin');
    expect(evidenceSql).not.toContain('assigned_to_user_id');
  });

  it('rejects non-multipart evidence payloads', async () => {
    const req = new Request('http://localhost/api/v1/operation/evidence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checklistExecutionId: 'chk-exec-1', url: 'https://example.com/file.jpg' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Adjunta una foto o un archivo PDF como evidencia.');
  });

  it('stores multipart evidence for the assigned staff member', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM checklist_executions')) {
        return {
          rows: [
            {
              id: 'chk-exec-1',
              client_id: 'client_001',
              building_id: 'b1',
              task_id: 'task-1',
              assigned_to_user_id: 'u_staff',
              status: 'PENDING',
            },
          ],
        };
      }
      return { rows: [] };
    });

    storageMocks.saveEvidenceFile.mockResolvedValue({
      originalName: 'evidencia.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 4,
      storagePath: '.data/uploads/evidence/chk-exec-1/ev_test.jpg',
      publicPath: '/api/v1/operation/evidence/ev_test',
    });

    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO evidence_attachments')) {
        return {
          rows: [
            {
              id: 'ev_test',
              client_id: 'client_001',
              building_id: 'b1',
              unit_id: null,
              incident_id: null,
              task_id: 'task-1',
              checklist_execution_id: 'chk-exec-1',
              file_name: 'evidencia.jpg',
              mime_type: 'image/jpeg',
              size_bytes: 4,
              storage_path: '.data/uploads/evidence/chk-exec-1/ev_test.jpg',
              public_path: '/api/v1/operation/evidence/ev_test',
              url: '/api/v1/operation/evidence/ev_test',
              uploaded_by_user_id: 'u_staff',
              created_at: new Date().toISOString(),
              deleted_at: null,
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const formData = new FormData();
    formData.set('checklistExecutionId', 'chk-exec-1');
    formData.set('file', new File([new Uint8Array([1, 2, 3, 4])], 'evidencia.jpg', { type: 'image/jpeg' }));

    const req = new Request('http://localhost/api/v1/operation/evidence', {
      method: 'POST',
      body: formData,
    });
    Object.defineProperty(req, 'formData', { value: async () => formData });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(storageMocks.saveEvidenceFile).toHaveBeenCalledTimes(1);
    expect(storageMocks.deleteEvidenceFile).not.toHaveBeenCalled();

    const data = (await res.json()) as { evidence?: { fileName: string; url: string; mimeType: string } };
    expect(data.evidence?.fileName).toBe('evidencia.jpg');
    expect(data.evidence?.mimeType).toBe('image/jpeg');
    expect(data.evidence?.url).toBe('/api/v1/operation/evidence/ev_test');
  });
});
