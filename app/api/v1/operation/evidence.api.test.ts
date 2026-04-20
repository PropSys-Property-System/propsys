import { describe, expect, it, vi } from 'vitest';
import { POST } from './evidence/route';

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
    poolQuery.mockReset();
    clientQuery.mockReset();
    storageMocks.saveEvidenceFile.mockReset();
    storageMocks.deleteEvidenceFile.mockReset();
    storageMocks.isAllowedEvidence.mockReset();
    storageMocks.isAllowedEvidence.mockReturnValue(true);

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
      storagePath: 'public/uploads/evidence/chk-exec-1/ev_test.jpg',
      publicPath: '/uploads/evidence/chk-exec-1/ev_test.jpg',
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
              storage_path: 'public/uploads/evidence/chk-exec-1/ev_test.jpg',
              public_path: '/uploads/evidence/chk-exec-1/ev_test.jpg',
              url: '/uploads/evidence/chk-exec-1/ev_test.jpg',
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
    expect(data.evidence?.url).toBe('/uploads/evidence/chk-exec-1/ev_test.jpg');
  });
});
