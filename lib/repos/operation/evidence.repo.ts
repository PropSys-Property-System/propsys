import { EvidenceAttachment, User } from '@/lib/types';
import { MOCK_EVIDENCE_ATTACHMENTS } from '@/lib/mocks';
import { canAccessClientRecord, filterItemsByTenant, requireClientContext } from '@/lib/auth/access-rules';
import { accessScope } from '@/lib/access/access-scope';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { unitsRepo } from '@/lib/repos/physical/units.repo';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const evidenceRepo = {
  async listForUser(user: User): Promise<EvidenceAttachment[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ evidence: EvidenceAttachment[] }>('/api/v1/operation/evidence', {
        credentials: 'include',
      });
      return data.evidence;
    }
    await sleep(150);

    if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
      return [];
    }

    const tenantScoped = filterItemsByTenant(MOCK_EVIDENCE_ATTACHMENTS, user);

    if (accessScope(user) === 'PORTFOLIO') return tenantScoped;

    if (accessScope(user) === 'BUILDING') {
      const buildingIds = (await buildingsRepo.listForUser(user)).map((building) => building.id);
      if (buildingIds.length === 0) return [];
      return tenantScoped.filter((item) => buildingIds.includes(item.buildingId));
    }

    const unitIds = (await unitsRepo.listForUser(user)).map((unit) => unit.id);
    if (unitIds.length === 0) return [];
    return tenantScoped.filter((item) => !item.unitId || unitIds.includes(item.unitId));
  },

  async listForChecklistExecution(user: User, checklistExecutionId: string): Promise<EvidenceAttachment[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ evidence: EvidenceAttachment[] }>(
        `/api/v1/operation/evidence?checklistExecutionId=${encodeURIComponent(checklistExecutionId)}`,
        { credentials: 'include' }
      );
      return data.evidence;
    }
    await sleep(100);
    return (await this.listForUser(user)).filter((item) => item.checklistExecutionId === checklistExecutionId);
  },

  async addForChecklistExecution(
    _user: User,
    _input: { checklistExecutionId: string; url: string; fileName?: string; mimeType?: string }
  ): Promise<EvidenceAttachment> {
    void _user;
    void _input;
    throw new Error('Adjunta una foto o un archivo PDF como evidencia.');
  },

  async uploadForChecklistExecution(
    user: User,
    input: { checklistExecutionId: string; file: File }
  ): Promise<EvidenceAttachment> {
    if (isDbMode()) {
      const formData = new FormData();
      formData.set('checklistExecutionId', input.checklistExecutionId);
      formData.set('file', input.file);

      const res = await fetch('/api/v1/operation/evidence', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = (await res.json().catch(() => null)) as { evidence?: EvidenceAttachment; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      if (!data?.evidence) throw new Error('Respuesta invalida');
      return data.evidence;
    }

    await sleep(150);

    const now = new Date().toISOString();
    const id = `ev_${Date.now()}`;
    const previewUrl = URL.createObjectURL(input.file);
    const evidence: EvidenceAttachment = {
      id,
      clientId: requireClientContext(user, 'Selecciona un cliente para continuar.'),
      buildingId: 'b1',
      checklistExecutionId: input.checklistExecutionId,
      fileName: input.file.name,
      mimeType: input.file.type || 'application/octet-stream',
      sizeBytes: input.file.size,
      publicPath: previewUrl,
      url: previewUrl,
      uploadedByUserId: user.id,
      createdAt: now,
    };
    MOCK_EVIDENCE_ATTACHMENTS.unshift(evidence);
    return evidence;
  },

  async deleteForUser(user: User, id: string): Promise<boolean> {
    if (isDbMode()) {
      const res = await fetch(`/api/v1/operation/evidence/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      return Boolean(data?.ok);
    }

    await sleep(100);

    const index = MOCK_EVIDENCE_ATTACHMENTS.findIndex((item) => item.id === id);
    if (index === -1) return false;
    const current = MOCK_EVIDENCE_ATTACHMENTS[index];
    if (!canAccessClientRecord(user, current.clientId)) return false;
    if (user.internalRole === 'STAFF' && current.uploadedByUserId !== user.id) throw new Error('No autorizado');
    MOCK_EVIDENCE_ATTACHMENTS.splice(index, 1);
    return true;
  },
};
