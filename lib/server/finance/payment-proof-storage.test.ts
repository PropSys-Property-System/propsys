import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isAllowedPaymentProof, readPaymentProofFile, savePaymentProofFile } from './payment-proof-storage';

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

describe('payment proof storage', () => {
  beforeEach(() => {
    fsMocks.mkdir.mockReset();
    fsMocks.readFile.mockReset();
    fsMocks.unlink.mockReset();
    fsMocks.writeFile.mockReset();
  });

  it('stores payment proofs outside public and exposes only the authenticated API URL', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'comprobante.jpg', { type: 'image/jpeg' });

    const saved = await savePaymentProofFile({
      receiptId: 'rect_1',
      proofId: 'rpp_1',
      file,
    });

    expect(saved.storagePath).toContain(path.join('.data', 'uploads', 'finance', 'payment-proofs', 'rect_1', 'rpp_1.jpg'));
    expect(saved.storagePath).not.toContain(path.join('public', 'uploads'));
    expect(saved.publicPath).toBe('/api/v1/finance/payment-proofs/rpp_1');
    expect(fsMocks.writeFile).toHaveBeenCalledTimes(1);
    expect(String(fsMocks.writeFile.mock.calls[0][0])).toContain(
      path.join('.data', 'uploads', 'finance', 'payment-proofs', 'rect_1', 'rpp_1.jpg')
    );
  });

  it('rejects unsupported file types', () => {
    expect(isAllowedPaymentProof('malware.exe', 'application/octet-stream')).toBe(false);
    expect(isAllowedPaymentProof('comprobante.pdf', 'application/pdf')).toBe(true);
  });

  it('reads by private storage path', async () => {
    fsMocks.readFile.mockResolvedValue(Buffer.from([4, 5, 6]));

    const file = await readPaymentProofFile('.data/uploads/finance/payment-proofs/rect_1/rpp_1.jpg');

    expect(file).toEqual(Buffer.from([4, 5, 6]));
    expect(String(fsMocks.readFile.mock.calls[0][0])).toContain(
      path.join('.data', 'uploads', 'finance', 'payment-proofs', 'rect_1', 'rpp_1.jpg')
    );
  });
});
