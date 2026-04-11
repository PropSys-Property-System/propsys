import { User } from '@/lib/types';

export type AccessScope = 'PORTFOLIO' | 'BUILDING' | 'UNIT';

export function accessScope(user: User): AccessScope {
  switch (user.internalRole) {
    case 'ROOT_ADMIN':
    case 'CLIENT_MANAGER':
      return 'PORTFOLIO';
    case 'BUILDING_ADMIN':
    case 'STAFF':
      return 'BUILDING';
    case 'OWNER':
    case 'OCCUPANT':
      return 'UNIT';
    default: {
      const _exhaustiveCheck: never = user.internalRole;
      return _exhaustiveCheck;
    }
  }
}

