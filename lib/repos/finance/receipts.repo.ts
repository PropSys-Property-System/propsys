import { Receipt, ReceiptStatus, User } from '@/lib/types';
import { MOCK_RECEIPTS } from '@/lib/mocks';
import { filterItemsByTenant } from '@/lib/auth/access-rules';
import { accessScope } from '@/lib/access/access-scope';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { unitsRepo } from '@/lib/repos/physical/units.repo';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type CreateReceiptInput = {
  buildingId: string;
  unitId: string;
  amount: number;
  currency: string;
  description?: string | null;
  issueDate: string;
  dueDate: string;
};

export type UpdateReceiptStatusInput = {
  receiptId: string;
  status: Extract<ReceiptStatus, 'PAID' | 'CANCELLED'>;
};

export type EditReceiptInput = {
  receiptId: string;
  amount: number;
  currency: string;
  description: string;
  issueDate: string;
  dueDate: string;
};

export const receiptsRepo = {
  async listForUser(user: User): Promise<Receipt[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ receipts: Receipt[] }>('/api/v1/finance/receipts', { credentials: 'include' });
      return data.receipts;
    }
    await sleep(350);

    const tenantScoped = filterItemsByTenant(MOCK_RECEIPTS, user);
    const buildingIds = (await buildingsRepo.listForUser(user)).map((b) => b.id);

    if (accessScope(user) === 'PORTFOLIO') {
      return tenantScoped.filter((r) => buildingIds.includes(r.buildingId));
    }

    if (accessScope(user) === 'BUILDING') {
      if (buildingIds.length === 0) return [];
      return tenantScoped.filter((r) => buildingIds.includes(r.buildingId));
    }

    const unitIds = (await unitsRepo.listForUser(user)).map((u) => u.id);
    return tenantScoped.filter((r) => unitIds.includes(r.unitId));
  },

  async getByIdForUser(user: User, id: string): Promise<Receipt | null> {
    if (isDbMode()) {
      const res = await fetch(`/api/v1/finance/receipts/${id}`, { credentials: 'include' });
      if (res.status === 404) return null;
      if (!res.ok) {
        const ct = res.headers.get('content-type') ?? '';
        if (ct.includes('application/json')) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error || `Error HTTP ${res.status}`);
        }
        throw new Error(`Error HTTP ${res.status}`);
      }
      const data = (await res.json().catch(() => null)) as { receipt?: Receipt | null } | null;
      return data?.receipt ?? null;
    }
    const list = await receiptsRepo.listForUser(user);
    return list.find((r) => r.id === id) ?? null;
  },

  async createForUser(user: User, input: CreateReceiptInput): Promise<Receipt> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ receipt: Receipt }>('/api/v1/finance/receipts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      return data.receipt;
    }

    await sleep(250);
    const building = (await buildingsRepo.listForUser(user)).find((item) => item.id === input.buildingId);
    const unit = (await unitsRepo.listForUser(user)).find((item) => item.id === input.unitId && item.buildingId === input.buildingId);
    if (!building || !unit) throw new Error('Unidad no encontrada o no pertenece al edificio.');

    const receipt: Receipt = {
      id: `mock-receipt-${Date.now()}`,
      clientId: building.clientId,
      buildingId: input.buildingId,
      unitId: input.unitId,
      number: `REC-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
      description: input.description?.trim() ?? '',
      amount: input.amount,
      currency: input.currency,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      status: 'PENDING',
    };
    MOCK_RECEIPTS.unshift(receipt);
    return receipt;
  },

  async updateStatusForUser(user: User, input: UpdateReceiptStatusInput): Promise<Receipt> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ receipt: Receipt }>(`/api/v1/finance/receipts/${input.receiptId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: input.status }),
      });
      return data.receipt;
    }

    await sleep(250);
    const receipt = (await receiptsRepo.listForUser(user)).find((item) => item.id === input.receiptId);
    if (!receipt) throw new Error('Recibo no encontrado.');
    if (receipt.status !== 'PENDING') throw new Error('Solo se pueden actualizar recibos pendientes.');
    receipt.status = input.status;
    return receipt;
  },

  async editForUser(user: User, input: EditReceiptInput): Promise<Receipt> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ receipt: Receipt }>(`/api/v1/finance/receipts/${input.receiptId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: input.amount,
          currency: input.currency,
          description: input.description,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
        }),
      });
      return data.receipt;
    }

    await sleep(250);
    const receipt = (await receiptsRepo.listForUser(user)).find((item) => item.id === input.receiptId);
    if (!receipt) throw new Error('Recibo no encontrado.');
    if (receipt.status !== 'PENDING') throw new Error('Solo se pueden editar recibos pendientes.');
    receipt.amount = input.amount;
    receipt.currency = input.currency;
    receipt.description = input.description;
    receipt.issueDate = input.issueDate;
    receipt.dueDate = input.dueDate;
    return { ...receipt };
  },

  async reportPaymentForUser(user: User, receiptId: string): Promise<Receipt> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ receipt: Receipt }>(`/api/v1/finance/receipts/${receiptId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'PAID' }),
      });
      return data.receipt;
    }

    await sleep(250);
    const receipt = (await receiptsRepo.listForUser(user)).find((item) => item.id === receiptId);
    if (!receipt) throw new Error('Recibo no encontrado.');
    if (receipt.status !== 'PENDING' && receipt.status !== 'OVERDUE') throw new Error('Este recibo no admite pago.');
    receipt.status = 'PAID';
    return { ...receipt };
  },

  async removeForUser(user: User, receiptId: string): Promise<void> {
    if (isDbMode()) {
      const res = await fetch(`/api/v1/finance/receipts/${receiptId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || `Error HTTP ${res.status}`);
      }
      return;
    }

    await sleep(150);
    const idx = MOCK_RECEIPTS.findIndex((item) => item.id === receiptId);
    if (idx === -1) throw new Error('Recibo no encontrado.');
    const receipt = MOCK_RECEIPTS[idx];
    const tenantScoped = await receiptsRepo.listForUser(user);
    if (!tenantScoped.some((item) => item.id === receiptId)) throw new Error('Recibo no encontrado.');
    if (receipt.status === 'PAID') throw new Error('No se puede eliminar un recibo pagado.');
    MOCK_RECEIPTS.splice(idx, 1);
  },
};
