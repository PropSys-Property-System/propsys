import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(MIME_BY_EXTENSION));
const ALLOWED_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION));

export type SavedEvidenceFile = {
  originalName: string;
  mimeType: string;
  publicPath: string;
  sizeBytes: number;
  storagePath: string;
};

function sanitizeFileName(fileName: string) {
  const normalized = fileName.normalize('NFKD').replace(/[^\x20-\x7E]/g, '');
  const cleaned = normalized.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || 'evidence';
}

function inferExtension(fileName: string, mimeType: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(extension)) return extension;
  const fromMime = Object.entries(MIME_BY_EXTENSION).find(([, allowedMime]) => allowedMime === mimeType)?.[0];
  return fromMime ?? '';
}

export function isAllowedEvidence(fileName: string, mimeType: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(extension)) return true;
  return Boolean(mimeType && ALLOWED_MIME_TYPES.has(mimeType));
}

function resolveMimeType(fileName: string, mimeType: string) {
  if (mimeType && ALLOWED_MIME_TYPES.has(mimeType)) return mimeType;
  const extension = inferExtension(fileName, mimeType);
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

export async function saveEvidenceFile(input: {
  checklistExecutionId: string;
  evidenceId: string;
  file: File;
}) {
  const safeFileName = sanitizeFileName(input.file.name || 'evidence');
  const extension = inferExtension(safeFileName, input.file.type);
  if (!extension) {
    throw new Error('Tipo de archivo no permitido. Solo imagenes o PDF.');
  }

  const relativeDirectory = path.posix.join('uploads', 'evidence', input.checklistExecutionId);
  const relativeStorageDirectory = path.join('public', 'uploads', 'evidence', input.checklistExecutionId);
  await mkdir(path.join(process.cwd(), relativeStorageDirectory), { recursive: true });

  const storageFileName = `${input.evidenceId}${extension}`;
  const storagePath = path.join(relativeStorageDirectory, storageFileName);
  const absoluteStoragePath = path.join(process.cwd(), storagePath);
  const publicPath = `/${path.posix.join(relativeDirectory, storageFileName)}`;

  const arrayBuffer = await input.file.arrayBuffer();
  await writeFile(absoluteStoragePath, Buffer.from(arrayBuffer));

  return {
    originalName: safeFileName,
    mimeType: resolveMimeType(safeFileName, input.file.type),
    publicPath,
    sizeBytes: input.file.size,
    storagePath,
  } satisfies SavedEvidenceFile;
}

export async function deleteEvidenceFile(storagePath: string | null | undefined) {
  if (!storagePath) return;
  const absoluteStoragePath = path.join(process.cwd(), storagePath);
  try {
    await unlink(absoluteStoragePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
