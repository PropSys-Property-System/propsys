import { ChecklistTemplate, User } from '@/lib/types';
import { MOCK_CHECKLIST_TEMPLATES } from '@/lib/mocks';
import { accessScope } from '@/lib/access/access-scope';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const checklistTemplatesRepo = {
  async listForUser(user: User): Promise<ChecklistTemplate[]> {
    await sleep(200);

    const tenantScoped =
      user.scope === 'platform'
        ? MOCK_CHECKLIST_TEMPLATES
        : user.clientId
          ? MOCK_CHECKLIST_TEMPLATES.filter((t) => t.clientId === user.clientId)
          : [];

    if (accessScope(user) === 'PORTFOLIO') return tenantScoped;

    if (accessScope(user) === 'BUILDING') {
      if (!user.buildingId) return [];
      return tenantScoped.filter((t) => t.buildingId === user.buildingId);
    }

    return [];
  },
};
