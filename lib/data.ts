import {
  Building,
  CommonArea,
  Notice,
  Receipt,
  Reservation,
  StaffMember,
  Ticket,
  Unit,
  User,
  UserRole,
} from '@/lib/types';
import {
  MOCK_BUILDINGS,
  MOCK_COMMON_AREAS,
  MOCK_NOTICES,
  MOCK_RECEIPTS,
  MOCK_RESERVATIONS,
  MOCK_STAFF_MEMBERS,
  MOCK_TICKETS,
  MOCK_UNITS,
  MOCK_USERS,
} from '@/lib/mocks';

export interface BuildingsRepository {
  listForUser: (user: User) => Promise<Building[]>;
}

export interface UnitsRepository {
  listForUser: (user: User) => Promise<Unit[]>;
}

export interface ReceiptsRepository {
  listForUser: (user: User) => Promise<Receipt[]>;
  getByIdForUser: (user: User, id: string) => Promise<Receipt | null>;
}

export interface StaffRepository {
  listForBuilding: (buildingId: string) => Promise<StaffMember[]>;
}

export interface CommonAreasRepository {
  listForBuilding: (buildingId: string) => Promise<CommonArea[]>;
}

export interface ReservationsRepository {
  listForUser: (user: User) => Promise<Reservation[]>;
}

export interface NoticesRepository {
  listForUser: (user: User) => Promise<Notice[]>;
}

export interface TicketsRepository {
  listForUser: (user: User) => Promise<Ticket[]>;
}

export interface UsersRepository {
  listForUser: (user: User) => Promise<User[]>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const roleScope = (role: UserRole) => {
  if (role === 'MANAGER') return 'PORTFOLIO';
  if (role === 'BUILDING_ADMIN' || role === 'STAFF') return 'BUILDING';
  return 'UNIT';
};

export const buildingsRepo: BuildingsRepository = {
  async listForUser(user) {
    await sleep(300);
    if (roleScope(user.role) === 'PORTFOLIO') return MOCK_BUILDINGS;
    if (!user.buildingId) return [];
    return MOCK_BUILDINGS.filter((b) => b.id === user.buildingId);
  },
};

export const unitsRepo: UnitsRepository = {
  async listForUser(user) {
    await sleep(300);
    if (roleScope(user.role) === 'PORTFOLIO') return MOCK_UNITS;
    if (roleScope(user.role) === 'BUILDING') {
      if (!user.buildingId) return [];
      return MOCK_UNITS.filter((u) => u.buildingId === user.buildingId);
    }
    if (user.role === 'OWNER') {
      return MOCK_UNITS.filter((u) => u.ownerId === user.id);
    }
    if (user.unitId) {
      return MOCK_UNITS.filter((u) => u.id === user.unitId);
    }
    return [];
  },
};

export const receiptsRepo: ReceiptsRepository = {
  async listForUser(user) {
    await sleep(350);
    if (roleScope(user.role) === 'PORTFOLIO') return MOCK_RECEIPTS;
    if (roleScope(user.role) === 'BUILDING') {
      if (!user.buildingId) return [];
      return MOCK_RECEIPTS.filter((r) => r.buildingId === user.buildingId);
    }
    const unitIds = (await unitsRepo.listForUser(user)).map((u) => u.id);
    return MOCK_RECEIPTS.filter((r) => unitIds.includes(r.unitId));
  },
  async getByIdForUser(user, id) {
    const list = await this.listForUser(user);
    return list.find((r) => r.id === id) ?? null;
  },
};

export const staffRepo: StaffRepository = {
  async listForBuilding(buildingId) {
    await sleep(300);
    return MOCK_STAFF_MEMBERS.filter((s) => s.buildingId === buildingId);
  },
};

export const commonAreasRepo: CommonAreasRepository = {
  async listForBuilding(buildingId) {
    await sleep(250);
    return MOCK_COMMON_AREAS.filter((a) => a.buildingId === buildingId);
  },
};

export const reservationsRepo: ReservationsRepository = {
  async listForUser(user) {
    await sleep(350);
    if (roleScope(user.role) === 'PORTFOLIO') return MOCK_RESERVATIONS;
    if (roleScope(user.role) === 'BUILDING') {
      if (!user.buildingId) return [];
      return MOCK_RESERVATIONS.filter((r) => r.buildingId === user.buildingId);
    }
    const unitIds = (await unitsRepo.listForUser(user)).map((u) => u.id);
    return MOCK_RESERVATIONS.filter((r) => unitIds.includes(r.unitId));
  },
};

export const noticesRepo: NoticesRepository = {
  async listForUser(user) {
    await sleep(250);
    const forAll = MOCK_NOTICES.filter((n) => n.audience === 'ALL_BUILDINGS');
    if (roleScope(user.role) === 'PORTFOLIO') return [...forAll, ...MOCK_NOTICES.filter((n) => n.audience === 'BUILDING')];
    if (!user.buildingId) return forAll;
    const forBuilding = MOCK_NOTICES.filter((n) => n.audience === 'BUILDING' && n.buildingId === user.buildingId);
    return [...forAll, ...forBuilding];
  },
};

export const ticketsRepo: TicketsRepository = {
  async listForUser(user) {
    await sleep(350);
    if (roleScope(user.role) === 'PORTFOLIO') return MOCK_TICKETS;
    if (roleScope(user.role) === 'BUILDING') {
      if (!user.buildingId) return [];
      return MOCK_TICKETS.filter((t) => t.buildingId === user.buildingId);
    }
    const unitIds = (await unitsRepo.listForUser(user)).map((u) => u.id);
    return MOCK_TICKETS.filter((t) => !t.unitId || unitIds.includes(t.unitId));
  },
};

export const usersRepo: UsersRepository = {
  async listForUser(user) {
    await sleep(250);
    if (user.role !== 'MANAGER') return [];
    return MOCK_USERS;
  },
};
