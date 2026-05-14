import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deletePaymentProofFile, isAllowedPaymentProof, readPaymentProofFile, savePaymentProofFile } from './payment-proof-storage';

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

describe('payment proof storage', () => {
  beforeEach(() => {
    fsMocks.mkdir.mockReset();
    fsMocks.readFile.mockReset();
    fsMocks.unlink.mockReset();
    fsMocks.writeFile.mockReset();
    supabaseMocks.uploadPrivateObject.mockReset();
    supabaseMocks.downloadPrivateObject.mockReset();
    supabaseMocks.deletePrivateObject.mockReset();
  });

  it('stores new payment proofs in private Supabase Storage and exposes only the authenticated API URL', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'comprobante.jpg', { type: 'image/jpeg' });
    supabaseMocks.uploadPrivateObject.mockResolvedValue(undefined);

    const saved = await savePaymentProofFile({
      clientId: 'client_001',
      buildingId: 'b1',
      receiptId: 'rect_1',
      proofId: 'rpp_1',
      file,
    });

    expect(saved.storagePath).toBe('client_001/b1/receipts/rect_1/rpp_1.jpg');
    expect(saved.publicPath).toBe('/api/v1/finance/payment-proofs/rpp_1');
    expect(fsMocks.writeFile).not.toHaveBeenCalled();
    expect(supabaseMocks.uploadPrivateObject).toHaveBeenCalledWith({
      bucketEnvName: 'SUPABASE_STORAGE_PAYMENT_PROOFS_BUCKET',
      objectKey: 'client_001/b1/receipts/rect_1/rpp_1.jpg',
      body: Buffer.from([1, 2, 3]),
      contentType: 'image/jpeg',
    });
  });

  it('rejects unsupported file types', () => {
    expect(isAllowedPaymentProof('malware.exe', 'application/octet-stream')).toBe(false);
    expect(isAllowedPaymentProof('comprobante.pdf', 'application/pdf')).toBe(true);
  });

  it('rejects unsupported file types before writing to storage', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'malware.exe', { type: 'application/octet-stream' });

    await expect(
      savePaymentProofFile({
        clientId: 'client_001',
        buildingId: 'b1',
        receiptId: 'rect_1',
        proofId: 'rpp_1',
        file,
      })
    ).rejects.toThrow('Tipo de archivo no permitido');

    expect(fsMocks.writeFile).not.toHaveBeenCalled();
    expect(supabaseMocks.uploadPrivateObject).not.toHaveBeenCalled();
  });

  it('downloads private Supabase Storage objects by object key', async () => {
    supabaseMocks.downloadPrivateObject.mockResolvedValue(Buffer.from([4, 5, 6]));

    const file = await readPaymentProofFile('client_001/b1/receipts/rect_1/rpp_1.jpg');

    expect(file).toEqual(Buffer.from([4, 5, 6]));
    expect(fsMocks.readFile).not.toHaveBeenCalled();
    expect(supabaseMocks.downloadPrivateObject).toHaveBeenCalledWith({
      bucketEnvName: 'SUPABASE_STORAGE_PAYMENT_PROOFS_BUCKET',
      objectKey: 'client_001/b1/receipts/rect_1/rpp_1.jpg',
    });
  });

  it('falls back to local disk for legacy private storage paths', async () => {
    fsMocks.readFile.mockResolvedValue(Buffer.from([4, 5, 6]));

    const file = await readPaymentProofFile('.data/uploads/finance/payment-proofs/rect_1/rpp_1.jpg');

    expect(file).toEqual(Buffer.from([4, 5, 6]));
    expect(String(fsMocks.readFile.mock.calls[0][0])).toContain(
      path.join('.data', 'uploads', 'finance', 'payment-proofs', 'rect_1', 'rpp_1.jpg')
    );
    expect(supabaseMocks.downloadPrivateObject).not.toHaveBeenCalled();
  });

  it('deletes private Supabase Storage objects by object key', async () => {
    supabaseMocks.deletePrivateObject.mockResolvedValue(undefined);

    await deletePaymentProofFile('client_001/b1/receipts/rect_1/rpp_1.jpg');

    expect(fsMocks.unlink).not.toHaveBeenCalled();
    expect(supabaseMocks.deletePrivateObject).toHaveBeenCalledWith({
      bucketEnvName: 'SUPABASE_STORAGE_PAYMENT_PROOFS_BUCKET',
      objectKey: 'client_001/b1/receipts/rect_1/rpp_1.jpg',
    });
  });
});
