import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteEvidenceFile, readEvidenceFile, saveEvidenceFile } from './evidence-storage';

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  unlink: vi.fn(),
  writeFile: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  uploadPrivateObject: vi.fn(),
  downloadPrivateObject: vi.fn(),
  deletePrivateObject: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  ...fsMocks,
  default: fsMocks,
}));

vi.mock('@/lib/server/storage/supabase-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/storage/supabase-storage')>();
  return {
    ...actual,
    uploadPrivateObject: supabaseMocks.uploadPrivateObject,
    downloadPrivateObject: supabaseMocks.downloadPrivateObject,
    deletePrivateObject: supabaseMocks.deletePrivateObject,
  };
});

describe('evidence storage', () => {
  beforeEach(() => {
    fsMocks.mkdir.mockReset();
    fsMocks.readFile.mockReset();
    fsMocks.unlink.mockReset();
    fsMocks.writeFile.mockReset();
    supabaseMocks.uploadPrivateObject.mockReset();
    supabaseMocks.downloadPrivateObject.mockReset();
    supabaseMocks.deletePrivateObject.mockReset();
  });

  it('stores new evidence in private Supabase Storage and exposes only the authenticated API URL', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'evidencia.jpg', { type: 'image/jpeg' });
    supabaseMocks.uploadPrivateObject.mockResolvedValue(undefined);

    const saved = await saveEvidenceFile({
      clientId: 'client_001',
      buildingId: 'b1',
      checklistExecutionId: 'chk-exec-1',
      evidenceId: 'ev_test',
      file,
    });

    expect(saved.storagePath).toBe('client_001/b1/evidence/chk-exec-1/ev_test.jpg');
    expect(saved.publicPath).toBe('/api/v1/operation/evidence/ev_test');
    expect(fsMocks.writeFile).not.toHaveBeenCalled();
    expect(supabaseMocks.uploadPrivateObject).toHaveBeenCalledWith({
      bucketEnvName: 'SUPABASE_STORAGE_EVIDENCE_BUCKET',
      objectKey: 'client_001/b1/evidence/chk-exec-1/ev_test.jpg',
      body: Buffer.from([1, 2, 3]),
      contentType: 'image/jpeg',
    });
  });

  it('rejects unsupported evidence files before writing to storage', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'evidencia.exe', { type: 'application/octet-stream' });

    await expect(
      saveEvidenceFile({
        clientId: 'client_001',
        buildingId: 'b1',
        checklistExecutionId: 'chk-exec-1',
        evidenceId: 'ev_test',
        file,
      })
    ).rejects.toThrow('Tipo de archivo no permitido');

    expect(fsMocks.writeFile).not.toHaveBeenCalled();
    expect(supabaseMocks.uploadPrivateObject).not.toHaveBeenCalled();
  });

  it('downloads private Supabase Storage evidence by object key', async () => {
    supabaseMocks.downloadPrivateObject.mockResolvedValue(Buffer.from([7, 8, 9]));

    const file = await readEvidenceFile('client_001/b1/evidence/chk-exec-1/ev_test.jpg');

    expect(file).toEqual(Buffer.from([7, 8, 9]));
    expect(fsMocks.readFile).not.toHaveBeenCalled();
    expect(supabaseMocks.downloadPrivateObject).toHaveBeenCalledWith({
      bucketEnvName: 'SUPABASE_STORAGE_EVIDENCE_BUCKET',
      objectKey: 'client_001/b1/evidence/chk-exec-1/ev_test.jpg',
    });
  });

  it('reads legacy public evidence paths from the private migrated location', async () => {
    fsMocks.readFile.mockResolvedValue(Buffer.from([1, 2, 3]));

    const file = await readEvidenceFile('/uploads/evidence/chk-exec-1/ev_legacy.jpg');

    expect(file).toEqual(Buffer.from([1, 2, 3]));
    expect(String(fsMocks.readFile.mock.calls[0][0])).toContain(
      path.join('.data', 'uploads', 'evidence', 'chk-exec-1', 'ev_legacy.jpg')
    );
    expect(String(fsMocks.readFile.mock.calls[0][0])).not.toContain(path.join('public', 'uploads', 'evidence'));
    expect(supabaseMocks.downloadPrivateObject).not.toHaveBeenCalled();
  });

  it('deletes both migrated private and residual public copies for legacy paths', async () => {
    fsMocks.unlink.mockResolvedValue(undefined);

    await deleteEvidenceFile('public/uploads/evidence/chk-exec-1/ev_legacy.jpg');

    const deletedPaths = fsMocks.unlink.mock.calls.map(([target]) => String(target));
    expect(deletedPaths[0]).toContain(path.join('.data', 'uploads', 'evidence', 'chk-exec-1', 'ev_legacy.jpg'));
    expect(deletedPaths[1]).toContain(path.join('public', 'uploads', 'evidence', 'chk-exec-1', 'ev_legacy.jpg'));
    expect(supabaseMocks.deletePrivateObject).not.toHaveBeenCalled();
  });

  it('deletes private Supabase Storage evidence by object key', async () => {
    supabaseMocks.deletePrivateObject.mockResolvedValue(undefined);

    await deleteEvidenceFile('client_001/b1/evidence/chk-exec-1/ev_test.jpg');

    expect(fsMocks.unlink).not.toHaveBeenCalled();
    expect(supabaseMocks.deletePrivateObject).toHaveBeenCalledWith({
      bucketEnvName: 'SUPABASE_STORAGE_EVIDENCE_BUCKET',
      objectKey: 'client_001/b1/evidence/chk-exec-1/ev_test.jpg',
    });
  });
});
