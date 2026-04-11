import { EvidenceAttachment, User } from '@/lib/types';
import { MOCK_EVIDENCE_ATTACHMENTS } from '@/lib/mocks';
import { accessScope } from '@/lib/access/access-scope';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { unitsRepo } from '@/lib/repos/physical/units.repo';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const evidenceRepo = {
  async listForUser(user: User): Promise<EvidenceAttachment[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ evidence: EvidenceAttachment[] }>('/api/v1/operation/evidence', { credentials: 'include' });
      return data.evidence;
    }
    await sleep(150);

    const tenantScoped =
      user.scope === 'platform'
        ? MOCK_EVIDENCE_ATTACHMENTS
        : user.clientId
          ? MOCK_EVIDENCE_ATTACHMENTS.filter((x) => x.clientId === user.clientId)
          : [];

    if (accessScope(user) === 'PORTFOLIO') return tenantScoped;

    if (accessScope(user) === 'BUILDING') {
      const buildingIds = (await buildingsRepo.listForUser(user)).map((b) => b.id);
      if (buildingIds.length === 0) return [];
      return tenantScoped.filter((x) => buildingIds.includes(x.buildingId));
    }

    const unitIds = (await unitsRepo.listForUser(user)).map((u) => u.id);
    if (unitIds.length === 0) return [];
    return tenantScoped.filter((x) => !x.unitId || unitIds.includes(x.unitId));
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
    return (await this.listForUser(user)).filter((x) => x.checklistExecutionId === checklistExecutionId);
  },

  async addForChecklistExecution(
    user: User,
    input: { checklistExecutionId: string; url: string; fileName?: string; mimeType?: string }
  ): Promise<EvidenceAttachment> {
    if (isDbMode()) {
      const res = await fetch('/api/v1/operation/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      const data = (await res.json().catch(() => null)) as { evidence?: EvidenceAttachment; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      if (!data?.evidence) throw new Error('Respuesta inválida');
      return data.evidence;
    }
    await sleep(150);
    throw new Error('No disponible en mock');
  },
};

