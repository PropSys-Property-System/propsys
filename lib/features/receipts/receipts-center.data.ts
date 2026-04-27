import { receiptsRepo, type CreateReceiptInput, type UpdateReceiptStatusInput } from '@/lib/repos/finance/receipts.repo';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { unitsRepo } from '@/lib/repos/physical/units.repo';
import type { Building, Receipt, Unit, User } from '@/lib/types';

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
};

export type ReceiptDetailData = {
  receipt: Receipt | null;
  building: Building | null;
  unit: Unit | null;
};

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
  return {
    receipts: await receiptsRepo.listForUser(user),
  };
}

async function loadReceiptDetailData(user: User, receiptId: string): Promise<ReceiptDetailData> {
  const receipt = await receiptsRepo.getByIdForUser(user, receiptId);
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
