import type { User } from '@/lib/types';

export type UserInvitationRole = 'CLIENT_MANAGER' | 'BUILDING_ADMIN' | 'STAFF' | 'OWNER' | 'OCCUPANT';

export type CreateUserInvitationInput = {
  email: string;
  name: string;
  internalRole: UserInvitationRole;
  clientId?: string;
  buildingId?: string;
  unitId?: string;
};

export type CreatedUserInvitation = {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt?: string;
};

export type InvitationDelivery = {
  mode?: 'email' | 'manual_link' | string;
  inviteLink?: string;
  token?: string;
};

export type CreateUserInvitationResult = {
  user?: User;
  invitation?: CreatedUserInvitation;
  delivery?: InvitationDelivery;
};

const EMAIL_PROVIDER_ERROR =
  'No hay proveedor de correo configurado para enviar invitaciones. Reemplaza re_xxxxxxxxx por tu API key real de Resend.';

function shouldSendBuildingId(role: UserInvitationRole): boolean {
  return role === 'BUILDING_ADMIN' || role === 'STAFF';
}

function shouldSendUnitId(role: UserInvitationRole): boolean {
  return role === 'OWNER' || role === 'OCCUPANT';
}

async function readErrorMessage(res: Response): Promise<string> {
  if (res.status === 503) return EMAIL_PROVIDER_ERROR;

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (data?.error) return data.error;
  }

  if (res.status === 403) return 'No autorizado';
  if (res.status === 409) return 'No se pudo crear la invitacion por un conflicto de usuario o asignacion existente.';
  return `Error HTTP ${res.status}`;
}

function buildLocalInviteLink(token: string): string {
  const baseUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const url = new URL('/invitations/accept', baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

function withDevelopmentInviteLinkFallback(result: CreateUserInvitationResult): CreateUserInvitationResult {
  const delivery = result.delivery;
  if (!delivery || delivery.inviteLink || !delivery.token || process.env.NODE_ENV === 'production') {
    return result;
  }

  return {
    ...result,
    delivery: {
      ...delivery,
      inviteLink: buildLocalInviteLink(delivery.token),
    },
  };
}

export async function createUserInvitation(input: CreateUserInvitationInput): Promise<CreateUserInvitationResult> {
  const payload: Record<string, string> = {
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    internalRole: input.internalRole,
  };

  if (shouldSendBuildingId(input.internalRole) && input.buildingId) {
    payload.buildingId = input.buildingId;
  }
  if (shouldSendUnitId(input.internalRole) && input.unitId) {
    payload.unitId = input.unitId;
  }
  if (input.internalRole === 'CLIENT_MANAGER' && input.clientId) {
    payload.clientId = input.clientId;
  }

  const res = await fetch('/api/v1/users/invitations', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  return withDevelopmentInviteLinkFallback((await res.json()) as CreateUserInvitationResult);
}
