import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import {
  deletePrivateObject,
  downloadPrivateObject,
  isSupabaseObjectKey,
  uploadPrivateObject,
} from '@/lib/server/storage/supabase-storage';

export const MAX_PAYMENT_PROOF_BYTES = 10 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(MIME_BY_EXTENSION));
const ALLOWED_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION));
const PRIVATE_PAYMENT_PROOFS_DIRECTORY = path.join('.data', 'uploads', 'finance', 'payment-proofs');
const PAYMENT_PROOFS_BUCKET_ENV = 'SUPABASE_STORAGE_PAYMENT_PROOFS_BUCKET';

export type SavedPaymentProofFile = {
  originalName: string;
  mimeType: string;
  publicPath: string;
  sizeBytes: number;
  storagePath: string;
};

function sanitizeFileName(fileName: string) {
  const normalized = fileName.normalize('NFKD').replace(/[^\x20-\x7E]/g, '');
  const cleaned = normalized.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || 'payment-proof';
}

function sanitizePathSegment(value: string, fallback: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || fallback;
}

function inferExtension(fileName: string, mimeType: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(extension)) return extension;
  const fromMime = Object.entries(MIME_BY_EXTENSION).find(([, allowedMime]) => allowedMime === mimeType)?.[0];
  return fromMime ?? '';
}

export function isAllowedPaymentProof(fileName: string, mimeType: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(extension)) return true;
  return Boolean(mimeType && ALLOWED_MIME_TYPES.has(mimeType));
}

function resolveMimeType(fileName: string, mimeType: string) {
  if (mimeType && ALLOWED_MIME_TYPES.has(mimeType)) return mimeType;
  const extension = inferExtension(fileName, mimeType);
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

function isPathInsideRoot(absolutePath: string, absoluteRoot: string) {
  return absolutePath === absoluteRoot || absolutePath.startsWith(`${absoluteRoot}${path.sep}`);
}

function resolvePrivatePaymentProofStoragePath(storagePath: string) {
  const absolutePath = path.resolve(process.cwd(), storagePath);
  const absolutePrivateRoot = path.resolve(process.cwd(), PRIVATE_PAYMENT_PROOFS_DIRECTORY);
  if (!isPathInsideRoot(absolutePath, absolutePrivateRoot)) throw new Error('Ruta de comprobante invalida.');
  return absolutePath;
}

function isLegacyPaymentProofPath(storagePath: string) {
  const normalized = storagePath.replace(/\\/g, '/').replace(/^\.\//, '');
  return normalized.startsWith('.data/uploads/finance/payment-proofs/');
}

async function readLegacyPaymentProofFile(storagePath: string) {
  try {
    return await readFile(resolvePrivatePaymentProofStoragePath(storagePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    if (error instanceof Error && error.message.includes('Ruta de comprobante invalida')) return null;
    throw error;
  }
}

export async function savePaymentProofFile(input: {
  clientId: string;
  buildingId: string;
  receiptId: string;
  proofId: string;
  file: File;
}) {
  const safeFileName = sanitizeFileName(input.file.name || 'payment-proof');
  const extension = inferExtension(safeFileName, input.file.type);
  if (!extension) {
    throw new Error('Tipo de archivo no permitido. Solo imagenes o PDF.');
  }

  const safeClientId = sanitizePathSegment(input.clientId, 'client');
  const safeBuildingId = sanitizePathSegment(input.buildingId, 'building');
  const safeReceiptId = sanitizePathSegment(input.receiptId, 'receipt');
  const safeProofId = sanitizePathSegment(input.proofId, 'proof');
  const storagePath = `${safeClientId}/${safeBuildingId}/receipts/${safeReceiptId}/${safeProofId}${extension}`;
  const publicPath = `/api/v1/finance/payment-proofs/${encodeURIComponent(input.proofId)}`;

  const arrayBuffer = await input.file.arrayBuffer();
  await uploadPrivateObject({
    bucketEnvName: PAYMENT_PROOFS_BUCKET_ENV,
    objectKey: storagePath,
    body: Buffer.from(arrayBuffer),
    contentType: resolveMimeType(safeFileName, input.file.type),
  });

  return {
    originalName: safeFileName,
    mimeType: resolveMimeType(safeFileName, input.file.type),
    publicPath,
    sizeBytes: input.file.size,
    storagePath,
  } satisfies SavedPaymentProofFile;
}

export async function readPaymentProofFile(storagePath: string | null | undefined) {
  if (!storagePath) return null;
  if (isSupabaseObjectKey(storagePath)) {
    return downloadPrivateObject({ bucketEnvName: PAYMENT_PROOFS_BUCKET_ENV, objectKey: storagePath });
  }
  if (!isLegacyPaymentProofPath(storagePath)) return null;
  return readLegacyPaymentProofFile(storagePath);
}

export async function deletePaymentProofFile(storagePath: string | null | undefined) {
  if (!storagePath) return;
  if (isSupabaseObjectKey(storagePath)) {
    await deletePrivateObject({ bucketEnvName: PAYMENT_PROOFS_BUCKET_ENV, objectKey: storagePath });
    return;
  }
  if (!isLegacyPaymentProofPath(storagePath)) return;
  try {
    await unlink(resolvePrivatePaymentProofStoragePath(storagePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
