import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canAccessTenantEntity, canBypassTenantScope, hasTenantClientContext } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import {
  deleteEvidenceFile,
  isAllowedEvidence,
  MAX_EVIDENCE_BYTES,
  saveEvidenceFile,
} from '@/lib/server/operation/evidence-storage';
import type { EvidenceAttachment } from '@/lib/types';

export const runtime = 'nodejs';

type EvidenceRow = {
  id: string;
  client_id: string;
  building_id: string;
  unit_id: string | null;
  incident_id: string | null;
  task_id: string | null;
  checklist_execution_id: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: string | number | null;
  storage_path: string | null;
  public_path: string | null;
  url: string;
  uploaded_by_user_id: string;
  created_at: string;
  deleted_at: string | null;
};

function isUploadFile(value: FormDataEntryValue | null | undefined): value is File {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'name' in value &&
      'size' in value &&
      'type' in value &&
      'arrayBuffer' in value &&
      typeof value.arrayBuffer === 'function'
  );
}

async function listBuildingIdsForUser(
  pool: ReturnType<typeof getPool>,
  user: { id: string; clientId: string | null; scope: string; internalRole: string }
) {
  if (canBypassTenantScope(user)) {
    const all = await pool.query<{ id: string }>('SELECT id FROM buildings');
    return all.rows.map((row) => row.id);
  }
  if (!user.clientId) return [];
  if (user.internalRole === 'ROOT_ADMIN' || user.internalRole === 'CLIENT_MANAGER') {
    const all = await pool.query<{ id: string }>('SELECT id FROM buildings WHERE client_id = $1', [user.clientId]);
    return all.rows.map((row) => row.id);
  }
  if (user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'STAFF') {
    const rows = await pool.query<{ building_id: string }>(
      `SELECT building_id
       FROM user_building_assignments
       WHERE user_id = $1 AND client_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL`,
      [user.id, user.clientId]
    );
    return rows.rows.map((row) => row.building_id);
  }
  return [];
}

function toEvidence(row: EvidenceRow): EvidenceAttachment {
  const accessPath = `/api/v1/operation/evidence/${encodeURIComponent(row.id)}`;
  return {
    id: row.id,
    clientId: row.client_id,
    buildingId: row.building_id,
    unitId: row.unit_id ?? undefined,
    incidentId: row.incident_id ?? undefined,
    taskId: row.task_id ?? undefined,
    checklistExecutionId: row.checklist_execution_id ?? undefined,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : undefined,
    publicPath: accessPath,
    url: accessPath,
    uploadedByUserId: row.uploaded_by_user_id,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
    return NextResponse.json({ evidence: [] as EvidenceAttachment[] });
  }

  const bypassTenant = canBypassTenantScope(user);
  if (!hasTenantClientContext(user)) return NextResponse.json({ evidence: [] as EvidenceAttachment[] });

  const url = new URL(req.url);
  const checklistExecutionId = url.searchParams.get('checklistExecutionId');

  const pool = getPool();
  const tenantWhere = bypassTenant ? '' : 'AND client_id = $1';
  const tenantParams = bypassTenant ? [] : [user.clientId];

  if (checklistExecutionId) {
    const execRes = await pool.query<{ id: string; client_id: string; building_id: string; assigned_to_user_id: string }>(
      `SELECT id, client_id, building_id, assigned_to_user_id
       FROM checklist_executions
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [checklistExecutionId]
    );
    const exec = execRes.rows[0];
    if (!exec) return NextResponse.json({ evidence: [] as EvidenceAttachment[] });
    if (!canAccessTenantEntity(user, exec.client_id)) {
      return NextResponse.json({ evidence: [] as EvidenceAttachment[] });
    }
    if (user.internalRole === 'STAFF' && exec.assigned_to_user_id !== user.id) {
      return NextResponse.json({ evidence: [] as EvidenceAttachment[] });
    }
    if (user.internalRole === 'BUILDING_ADMIN') {
      const ok = await pool.query<{ ok: boolean }>(
        `SELECT true as ok
         FROM user_building_assignments
         WHERE user_id = $1 AND building_id = $2 AND client_id = $3 AND status = 'ACTIVE' AND deleted_at IS NULL
         LIMIT 1`,
        [user.id, exec.building_id, exec.client_id]
      );
      if (!ok.rows[0]) return NextResponse.json({ evidence: [] as EvidenceAttachment[] });
    }

    const rows = await pool.query<EvidenceRow>(
      `SELECT id, client_id, building_id, unit_id, incident_id, task_id, checklist_execution_id, file_name, mime_type, size_bytes, storage_path, public_path, url, uploaded_by_user_id, created_at, deleted_at
       FROM evidence_attachments
       WHERE deleted_at IS NULL
         ${tenantWhere}
         AND checklist_execution_id = $${tenantParams.length + 1}
       ORDER BY created_at DESC`,
      [...tenantParams, checklistExecutionId]
    );
    return NextResponse.json({ evidence: rows.rows.map(toEvidence) });
  }

  const buildingIds = await listBuildingIdsForUser(pool, user);
  if (buildingIds.length === 0) return NextResponse.json({ evidence: [] as EvidenceAttachment[] });

  const baseParams = [...tenantParams, buildingIds];
  const staffAssignedWhere =
    user.internalRole === 'STAFF'
      ? `AND EXISTS (
           SELECT 1
           FROM checklist_executions ce
           WHERE ce.id = evidence_attachments.checklist_execution_id
             AND ce.client_id = evidence_attachments.client_id
             AND ce.building_id = evidence_attachments.building_id
             AND ce.assigned_to_user_id = $${baseParams.length + 1}
             AND ce.deleted_at IS NULL
         )`
      : '';
  const queryParams = user.internalRole === 'STAFF' ? [...baseParams, user.id] : baseParams;

  const rows = await pool.query<EvidenceRow>(
    `SELECT id, client_id, building_id, unit_id, incident_id, task_id, checklist_execution_id, file_name, mime_type, size_bytes, storage_path, public_path, url, uploaded_by_user_id, created_at, deleted_at
     FROM evidence_attachments
     WHERE deleted_at IS NULL
       ${tenantWhere}
       AND building_id = ANY($${tenantParams.length + 1}::text[])
       ${staffAssignedWhere}
     ORDER BY created_at DESC`,
    queryParams
  );

  return NextResponse.json({ evidence: rows.rows.map(toEvidence) });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole !== 'STAFF' && user.internalRole !== 'BUILDING_ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const bypassTenant = canBypassTenantScope(user);
  if (!hasTenantClientContext(user)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const formData = await req.formData().catch(() => null);
  const checklistExecutionIdEntry = formData ? formData.get('checklistExecutionId') : null;
  const checklistExecutionId = typeof checklistExecutionIdEntry === 'string' ? checklistExecutionIdEntry.trim() : '';
  const fileValue = formData ? formData.get('file') : null;
  const file = isUploadFile(fileValue) ? fileValue : null;

  if (!file) return NextResponse.json({ error: 'Adjunta una foto o un archivo PDF como evidencia.' }, { status: 400 });
  if (!checklistExecutionId) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  if (file.size > MAX_EVIDENCE_BYTES) {
    return NextResponse.json({ error: 'El archivo supera el limite de 10 MB.' }, { status: 400 });
  }
  if (!isAllowedEvidence(file.name, file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido. Solo imagenes o PDF.' }, { status: 400 });
  }

  const pool = getPool();
  const execRes = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    task_id: string | null;
    assigned_to_user_id: string;
    status: string;
  }>(
    `SELECT id, client_id, building_id, task_id, assigned_to_user_id, status
     FROM checklist_executions
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [checklistExecutionId]
  );

  const exec = execRes.rows[0];
  if (!exec) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (!canAccessTenantEntity(user, exec.client_id)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  if (exec.status === 'APPROVED') {
    return NextResponse.json({ error: 'No puedes adjuntar evidencias a un checklist aprobado.' }, { status: 403 });
  }

  if (user.internalRole === 'STAFF' && exec.assigned_to_user_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  if (user.internalRole === 'BUILDING_ADMIN') {
    const ok = await pool.query<{ ok: boolean }>(
      `SELECT true as ok
       FROM user_building_assignments
       WHERE user_id = $1 AND building_id = $2 AND client_id = $3 AND status = 'ACTIVE' AND deleted_at IS NULL
       LIMIT 1`,
      [user.id, exec.building_id, exec.client_id]
    );
    if (!ok.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const clientId = bypassTenant ? exec.client_id : user.clientId!;
  const now = new Date().toISOString();
  const id = `ev_${Date.now()}_${randomUUID().slice(0, 8)}`;

  let savedFile: Awaited<ReturnType<typeof saveEvidenceFile>> | null = null;
  try {
    savedFile = await saveEvidenceFile({
      checklistExecutionId: exec.id,
      evidenceId: id,
      file,
    });
    const storedFile = savedFile;

    const evidence = await withTransaction(pool, async (db) => {
      const created = await db.query<EvidenceRow>(
        `INSERT INTO evidence_attachments (id, client_id, building_id, unit_id, incident_id, task_id, checklist_execution_id, file_name, mime_type, size_bytes, storage_path, public_path, url, uploaded_by_user_id, created_at)
         VALUES ($1, $2, $3, NULL, NULL, $4, $5, $6, $7, $8, $9, $10, $10, $11, $12)
         RETURNING id, client_id, building_id, unit_id, incident_id, task_id, checklist_execution_id, file_name, mime_type, size_bytes, storage_path, public_path, url, uploaded_by_user_id, created_at, deleted_at`,
        [
          id,
          clientId,
          exec.building_id,
          exec.task_id,
          exec.id,
          storedFile.originalName,
          storedFile.mimeType,
          storedFile.sizeBytes,
          storedFile.storagePath,
          storedFile.publicPath,
          user.id,
          now,
        ]
      );

      const entity = toEvidence(created.rows[0]);
      await insertAuditLog(db, {
        clientId,
        userId: user.id,
        action: 'CREATE',
        entity: 'EvidenceAttachment',
        entityId: entity.id,
        metadata: {
          buildingId: entity.buildingId,
          checklistExecutionId: entity.checklistExecutionId ?? null,
          taskId: entity.taskId ?? null,
          mimeType: entity.mimeType,
        },
        newData: entity,
      });
      return entity;
    });

    return NextResponse.json({ evidence });
  } catch (error) {
    try {
      await deleteEvidenceFile(savedFile?.storagePath);
    } catch {}
    const message = error instanceof Error ? error.message : 'No pudimos guardar la evidencia.';
    const status = message.includes('Tipo de archivo') ? 400 : 500;
    return NextResponse.json({ error: message || 'No pudimos guardar la evidencia.' }, { status });
  }
}
