import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import {
  deletePrivateObject,
  downloadPrivateObject,
  isSupabaseObjectKey,
  uploadPrivateObject,
} from '@/lib/server/storage/supabase-storage';

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
const PRIVATE_EVIDENCE_DIRECTORY = path.join('.data', 'uploads', 'evidence');
const LEGACY_PUBLIC_EVIDENCE_DIRECTORY = path.join('public', 'uploads', 'evidence');
const LEGACY_PUBLIC_EVIDENCE_URL_PREFIX = '/uploads/evidence/';
const EVIDENCE_BUCKET_ENV = 'SUPABASE_STORAGE_EVIDENCE_BUCKET';

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

function sanitizePathSegment(value: string, fallback: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || fallback;
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

function isPathInsideRoot(absolutePath: string, absoluteRoot: string) {
  return absolutePath === absoluteRoot || absolutePath.startsWith(`${absoluteRoot}${path.sep}`);
}

function legacyUrlToPublicStoragePath(value: string) {
  if (!value.startsWith(LEGACY_PUBLIC_EVIDENCE_URL_PREFIX)) return value;
  return path.join(LEGACY_PUBLIC_EVIDENCE_DIRECTORY, value.slice(LEGACY_PUBLIC_EVIDENCE_URL_PREFIX.length));
}

function legacyPublicStoragePathToPrivate(storagePath: string) {
  const normalizedPath = legacyUrlToPublicStoragePath(storagePath);
  const absoluteLegacyPath = path.resolve(process.cwd(), normalizedPath);
  const absoluteLegacyRoot = path.resolve(process.cwd(), LEGACY_PUBLIC_EVIDENCE_DIRECTORY);
  if (!isPathInsideRoot(absoluteLegacyPath, absoluteLegacyRoot)) return normalizedPath;
  return path.join(PRIVATE_EVIDENCE_DIRECTORY, path.relative(absoluteLegacyRoot, absoluteLegacyPath));
}

function resolvePrivateEvidenceStoragePath(storagePath: string) {
  const privateStoragePath = legacyPublicStoragePathToPrivate(storagePath);
  const absolutePath = path.resolve(process.cwd(), privateStoragePath);
  const absolutePrivateRoot = path.resolve(process.cwd(), PRIVATE_EVIDENCE_DIRECTORY);
  if (!isPathInsideRoot(absolutePath, absolutePrivateRoot)) throw new Error('Ruta de evidencia invalida.');
  return absolutePath;
}

function resolveLegacyPublicEvidenceStoragePath(storagePath: string) {
  const normalizedPath = legacyUrlToPublicStoragePath(storagePath);
  const absolutePath = path.resolve(process.cwd(), normalizedPath);
  const absoluteLegacyRoot = path.resolve(process.cwd(), LEGACY_PUBLIC_EVIDENCE_DIRECTORY);
  return isPathInsideRoot(absolutePath, absoluteLegacyRoot) ? absolutePath : null;
}

export async function saveEvidenceFile(input: {
  clientId: string;
  buildingId: string;
  checklistExecutionId?: string;
  incidentId?: string;
  evidenceId: string;
  file: File;
}) {
  const safeFileName = sanitizeFileName(input.file.name || 'evidence');
  const extension = inferExtension(safeFileName, input.file.type);
  if (!extension) {
    throw new Error('Tipo de archivo no permitido. Solo imagenes o PDF.');
  }

  const safeClientId = sanitizePathSegment(input.clientId, 'client');
  const safeBuildingId = sanitizePathSegment(input.buildingId, 'building');
  const safeChecklistExecutionId = input.checklistExecutionId ? sanitizePathSegment(input.checklistExecutionId, 'execution') : undefined;
  const safeIncidentId = input.incidentId ? sanitizePathSegment(input.incidentId, 'incident') : undefined;
  const safeEvidenceId = sanitizePathSegment(input.evidenceId, 'evidence');
  
  let parentPath = '';
  if (safeChecklistExecutionId) parentPath = safeChecklistExecutionId;
  else if (safeIncidentId) parentPath = `incident/${safeIncidentId}`;
  else throw new Error('Se requiere checklistExecutionId o incidentId');

  const storagePath = `${safeClientId}/${safeBuildingId}/evidence/${parentPath}/${safeEvidenceId}${extension}`;
  const publicPath = `/api/v1/operation/evidence/${encodeURIComponent(input.evidenceId)}`;

  const arrayBuffer = await input.file.arrayBuffer();
  await uploadPrivateObject({
    bucketEnvName: EVIDENCE_BUCKET_ENV,
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
  } satisfies SavedEvidenceFile;
}

export async function readEvidenceFile(storagePath: string | null | undefined) {
  if (!storagePath) return null;
  if (isSupabaseObjectKey(storagePath)) {
    return downloadPrivateObject({ bucketEnvName: EVIDENCE_BUCKET_ENV, objectKey: storagePath });
  }
  try {
    return await readFile(resolvePrivateEvidenceStoragePath(storagePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    if (error instanceof Error && error.message.includes('Ruta de evidencia invalida')) return null;
    throw error;
  }
}

export async function deleteEvidenceFile(storagePath: string | null | undefined) {
  if (!storagePath) return;
  if (isSupabaseObjectKey(storagePath)) {
    await deletePrivateObject({ bucketEnvName: EVIDENCE_BUCKET_ENV, objectKey: storagePath });
    return;
  }
  const absoluteStoragePath = resolvePrivateEvidenceStoragePath(storagePath);
  const legacyPublicPath = resolveLegacyPublicEvidenceStoragePath(storagePath);
  const pathsToDelete = legacyPublicPath ? [absoluteStoragePath, legacyPublicPath] : [absoluteStoragePath];
  for (const pathToDelete of pathsToDelete) {
    try {
      await unlink(pathToDelete);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
