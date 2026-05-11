import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

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

export async function savePaymentProofFile(input: { receiptId: string; proofId: string; file: File }) {
  const safeFileName = sanitizeFileName(input.file.name || 'payment-proof');
  const extension = inferExtension(safeFileName, input.file.type);
  if (!extension) {
    throw new Error('Tipo de archivo no permitido. Solo imagenes o PDF.');
  }

  const safeReceiptId = sanitizePathSegment(input.receiptId, 'receipt');
  const safeProofId = sanitizePathSegment(input.proofId, 'proof');
  const relativeStorageDirectory = path.join(PRIVATE_PAYMENT_PROOFS_DIRECTORY, safeReceiptId);
  await mkdir(path.join(process.cwd(), relativeStorageDirectory), { recursive: true });

  const storagePath = path.join(relativeStorageDirectory, `${safeProofId}${extension}`);
  const absoluteStoragePath = path.join(process.cwd(), storagePath);
  const publicPath = `/api/v1/finance/payment-proofs/${encodeURIComponent(input.proofId)}`;

  const arrayBuffer = await input.file.arrayBuffer();
  await writeFile(absoluteStoragePath, Buffer.from(arrayBuffer));

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
  return readFile(resolvePrivatePaymentProofStoragePath(storagePath));
}

export async function deletePaymentProofFile(storagePath: string | null | undefined) {
  if (!storagePath) return;
  try {
    await unlink(resolvePrivatePaymentProofStoragePath(storagePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
