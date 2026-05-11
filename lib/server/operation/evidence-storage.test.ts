import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteEvidenceFile, readEvidenceFile, saveEvidenceFile } from './evidence-storage';

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  unlink: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  ...fsMocks,
  default: fsMocks,
}));

describe('evidence storage', () => {
  beforeEach(() => {
    fsMocks.mkdir.mockReset();
    fsMocks.readFile.mockReset();
    fsMocks.unlink.mockReset();
    fsMocks.writeFile.mockReset();
  });

  it('stores new evidence outside public and exposes only the authenticated API URL', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'evidencia.jpg', { type: 'image/jpeg' });

    const saved = await saveEvidenceFile({
      checklistExecutionId: 'chk-exec-1',
      evidenceId: 'ev_test',
      file,
    });

    expect(saved.storagePath).toContain(path.join('.data', 'uploads', 'evidence', 'chk-exec-1', 'ev_test.jpg'));
    expect(saved.storagePath).not.toContain(path.join('public', 'uploads', 'evidence'));
    expect(saved.publicPath).toBe('/api/v1/operation/evidence/ev_test');
    expect(fsMocks.writeFile).toHaveBeenCalledTimes(1);
    expect(String(fsMocks.writeFile.mock.calls[0][0])).toContain(
      path.join('.data', 'uploads', 'evidence', 'chk-exec-1', 'ev_test.jpg')
    );
  });

  it('reads legacy public evidence paths from the private migrated location', async () => {
    fsMocks.readFile.mockResolvedValue(Buffer.from([1, 2, 3]));

    const file = await readEvidenceFile('/uploads/evidence/chk-exec-1/ev_legacy.jpg');

    expect(file).toEqual(Buffer.from([1, 2, 3]));
    expect(String(fsMocks.readFile.mock.calls[0][0])).toContain(
      path.join('.data', 'uploads', 'evidence', 'chk-exec-1', 'ev_legacy.jpg')
    );
    expect(String(fsMocks.readFile.mock.calls[0][0])).not.toContain(path.join('public', 'uploads', 'evidence'));
  });

  it('deletes both migrated private and residual public copies for legacy paths', async () => {
    fsMocks.unlink.mockResolvedValue(undefined);

    await deleteEvidenceFile('public/uploads/evidence/chk-exec-1/ev_legacy.jpg');

    const deletedPaths = fsMocks.unlink.mock.calls.map(([target]) => String(target));
    expect(deletedPaths[0]).toContain(path.join('.data', 'uploads', 'evidence', 'chk-exec-1', 'ev_legacy.jpg'));
    expect(deletedPaths[1]).toContain(path.join('public', 'uploads', 'evidence', 'chk-exec-1', 'ev_legacy.jpg'));
  });
});
