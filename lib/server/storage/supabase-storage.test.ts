import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deletePrivateObject, downloadPrivateObject, uploadPrivateObject } from './supabase-storage';

const fetchMock = vi.fn();

describe('supabase private storage helper', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-test');
    vi.stubEnv('SUPABASE_STORAGE_PAYMENT_PROOFS_BUCKET', 'propsys-payment-proofs');
  });

  it('uploads private objects with the service role credentials', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

    await uploadPrivateObject({
      bucketEnvName: 'SUPABASE_STORAGE_PAYMENT_PROOFS_BUCKET',
      objectKey: 'client_001/b1/receipts/rect_1/rpp_1.jpg',
      body: Buffer.from([1, 2, 3]),
      contentType: 'image/jpeg',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://project.supabase.co/storage/v1/object/propsys-payment-proofs/client_001/b1/receipts/rect_1/rpp_1.jpg');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      apikey: 'service-role-test',
      Authorization: 'Bearer service-role-test',
      'Content-Type': 'image/jpeg',
      'x-upsert': 'false',
    });
  });

  it('downloads private objects as buffers and returns null for missing objects', async () => {
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([4, 5, 6]), { status: 200 }));

    const file = await downloadPrivateObject({
      bucketEnvName: 'SUPABASE_STORAGE_PAYMENT_PROOFS_BUCKET',
      objectKey: 'client_001/b1/receipts/rect_1/rpp_1.jpg',
    });

    expect(file).toEqual(Buffer.from([4, 5, 6]));

    fetchMock.mockResolvedValueOnce(new Response('not found', { status: 404 }));
    const missing = await downloadPrivateObject({
      bucketEnvName: 'SUPABASE_STORAGE_PAYMENT_PROOFS_BUCKET',
      objectKey: 'client_001/b1/receipts/rect_1/missing.jpg',
    });

    expect(missing).toBeNull();
  });

  it('deletes private objects idempotently', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 404 }));

    await deletePrivateObject({
      bucketEnvName: 'SUPABASE_STORAGE_PAYMENT_PROOFS_BUCKET',
      objectKey: 'client_001/b1/receipts/rect_1/rpp_1.jpg',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('DELETE');
  });

  it('fails closed when required env vars are missing', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    await expect(
      uploadPrivateObject({
        bucketEnvName: 'SUPABASE_STORAGE_PAYMENT_PROOFS_BUCKET',
        objectKey: 'client_001/b1/receipts/rect_1/rpp_1.jpg',
        body: Buffer.from([1]),
        contentType: 'image/jpeg',
      })
    ).rejects.toThrow('SUPABASE_SERVICE_ROLE_KEY no configurada');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
