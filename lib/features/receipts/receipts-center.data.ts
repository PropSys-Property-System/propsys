import {
  receiptsRepo,
  type CreateReceiptInput,
  type EditReceiptInput,
  type UpdateReceiptStatusInput,
} from '@/lib/repos/finance/receipts.repo';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { unitsRepo } from '@/lib/repos/physical/units.repo';
import { fetchJsonOrThrow } from '@/lib/repos/http';
import type { Building, Receipt, ReceiptPaymentProofReviewAction, ReceiptPaymentProofView, Unit, User } from '@/lib/types';

export type ReceiptBuildingOption = {
  id: string;
  name: string;
  clientId?: string;
};

export type ReceiptUnitOption = {
  id: string;
  buildingId: string;
  number: string;
};

export type AdminReceiptsPageData = {
  receipts: Receipt[];
  buildings: ReceiptBuildingOption[];
  units: ReceiptUnitOption[];
};

export type ResidentReceiptsPageData = {
  receipts: Receipt[];
  buildings: ReceiptBuildingOption[];
  units: ReceiptUnitOption[];
};

export type ReceiptDetailData = {
  receipt: Receipt | null;
  building: Building | null;
  unit: Unit | null;
};

export type UploadReceiptPaymentProofInput = {
  receiptId: string;
  file: File;
  note?: string;
};

export type ReviewReceiptPaymentProofInput = {
  proofId: string;
  action: ReceiptPaymentProofReviewAction;
  reviewComment?: string;
};

export type ReceiptPaymentProofReviewResult = {
  proof: ReceiptPaymentProofView;
  receipt: Pick<Receipt, 'id' | 'status'> & Partial<Receipt>;
};

function maybeReceiptNumber(value: string) {
  return /^REC-/i.test(value);
}

async function resolveReceiptId(user: User, receiptIdentifier: string) {
  if (!maybeReceiptNumber(receiptIdentifier)) return receiptIdentifier;
  const receipts = await receiptsRepo.listForUser(user);
  return receipts.find((receipt) => receipt.number === receiptIdentifier)?.id ?? receiptIdentifier;
}

export async function loadAdminReceiptsPageData(user: User): Promise<AdminReceiptsPageData> {
  const [receipts, buildings, units] = await Promise.all([
    receiptsRepo.listForUser(user),
    buildingsRepo.listForUser(user),
    unitsRepo.listForUser(user),
  ]);

  return {
    receipts,
    buildings: buildings.map((building) => ({ id: building.id, name: building.name, clientId: building.clientId })),
    units: units.map((unit) => ({ id: unit.id, buildingId: unit.buildingId, number: unit.number })),
  };
}

export async function loadResidentReceiptsPageData(user: User): Promise<ResidentReceiptsPageData> {
  const [receipts, buildings, units] = await Promise.all([
    receiptsRepo.listForUser(user),
    buildingsRepo.listForUser(user),
    unitsRepo.listForUser(user),
  ]);

  return {
    receipts,
    buildings: buildings.map((building) => ({ id: building.id, name: building.name, clientId: building.clientId })),
    units: units.map((unit) => ({ id: unit.id, buildingId: unit.buildingId, number: unit.number })),
  };
}

async function loadReceiptDetailData(user: User, receiptId: string): Promise<ReceiptDetailData> {
  const resolvedReceiptId = await resolveReceiptId(user, receiptId);
  const receipt = await receiptsRepo.getByIdForUser(user, resolvedReceiptId);
  if (!receipt) {
    return {
      receipt: null,
      building: null,
      unit: null,
    };
  }

  const [buildings, units] = await Promise.all([buildingsRepo.listForUser(user), unitsRepo.listForUser(user)]);

  return {
    receipt,
    building: buildings.find((building) => building.id === receipt.buildingId) ?? null,
    unit: units.find((unit) => unit.id === receipt.unitId) ?? null,
  };
}

export async function loadAdminReceiptDetailData(user: User, receiptId: string): Promise<ReceiptDetailData> {
  return loadReceiptDetailData(user, receiptId);
}

export async function loadResidentReceiptDetailData(user: User, receiptId: string): Promise<ReceiptDetailData> {
  return loadReceiptDetailData(user, receiptId);
}

export async function createAdminReceipt(user: User, input: CreateReceiptInput): Promise<Receipt> {
  return receiptsRepo.createForUser(user, input);
}

export async function updateAdminReceiptStatus(user: User, input: UpdateReceiptStatusInput): Promise<Receipt> {
  return receiptsRepo.updateStatusForUser(user, input);
}

export async function editAdminReceipt(user: User, input: EditReceiptInput): Promise<Receipt> {
  return receiptsRepo.editForUser(user, input);
}

export async function removeAdminReceipt(user: User, receiptId: string): Promise<void> {
  return receiptsRepo.removeForUser(user, receiptId);
}

export async function listReceiptPaymentProofsForReceipt(_user: User, receiptId: string): Promise<ReceiptPaymentProofView[]> {
  const data = await fetchJsonOrThrow<{ proofs: ReceiptPaymentProofView[] }>(
    `/api/v1/finance/receipts/${encodeURIComponent(receiptId)}/payment-proofs`,
    { credentials: 'include' }
  );
  return data.proofs;
}

export async function listAdminReceiptPaymentProofs(
  _user: User,
  status: ReceiptPaymentProofView['status'] = 'PENDING_REVIEW'
): Promise<ReceiptPaymentProofView[]> {
  const data = await fetchJsonOrThrow<{ proofs: ReceiptPaymentProofView[] }>(
    `/api/v1/finance/payment-proofs?status=${encodeURIComponent(status)}`,
    { credentials: 'include' }
  );
  return data.proofs;
}

export async function uploadReceiptPaymentProof(_user: User, input: UploadReceiptPaymentProofInput): Promise<ReceiptPaymentProofView> {
  const resolvedReceiptId = await resolveReceiptId(_user, input.receiptId);
  const formData = new FormData();
  formData.set('file', input.file);
  if (input.note?.trim()) {
    formData.set('note', input.note.trim());
  }

  const data = await fetchJsonOrThrow<{ proof: ReceiptPaymentProofView }>(
    `/api/v1/finance/receipts/${encodeURIComponent(resolvedReceiptId)}/payment-proofs`,
    {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }
  );
  return data.proof;
}

export async function reviewReceiptPaymentProof(
  _user: User,
  input: ReviewReceiptPaymentProofInput
): Promise<ReceiptPaymentProofReviewResult> {
  return fetchJsonOrThrow<ReceiptPaymentProofReviewResult>(
    `/api/v1/finance/payment-proofs/${encodeURIComponent(input.proofId)}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: input.action,
        reviewComment: input.reviewComment?.trim() || undefined,
      }),
    }
  );
}
