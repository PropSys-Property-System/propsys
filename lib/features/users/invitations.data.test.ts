import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUserInvitation } from './invitations.data';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createUserInvitation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the invitation endpoint with email, name and internalRole', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        user: { id: 'u_invited', email: 'owner@example.com', name: 'Owner Invitada', internalRole: 'OWNER' },
        invitation: { id: 'inv_1', status: 'PENDING', expiresAt: '2026-05-12T00:00:00.000Z' },
        delivery: { mode: 'development_link', inviteLink: 'http://localhost/invitations/accept?token=abc', token: 'raw-token' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createUserInvitation({
      email: ' Owner@Example.com ',
      name: ' Owner Invitada ',
      internalRole: 'OWNER',
      unitId: 'unit_101',
    });

    expect(result.delivery?.inviteLink).toBe('http://localhost/invitations/accept?token=abc');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/users/invitations',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      })
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      email: 'owner@example.com',
      name: 'Owner Invitada',
      internalRole: 'OWNER',
    });
  });

  it('builds a local inviteLink from token when backend omits inviteLink outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ delivery: { mode: 'development_link', token: 'raw token' } })));

    const result = await createUserInvitation({
      email: 'owner@example.com',
      name: 'Owner Invitada',
      internalRole: 'OWNER',
      unitId: 'unit_101',
    });

    expect(result.delivery?.inviteLink).toBe('http://localhost:3000/invitations/accept?token=raw+token');
  });

  it('sends buildingId for STAFF and BUILDING_ADMIN invitations', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ invitation: { status: 'PENDING' } }));
    vi.stubGlobal('fetch', fetchMock);

    await createUserInvitation({
      email: 'staff@example.com',
      name: 'Staff Invitado',
      internalRole: 'STAFF',
      buildingId: 'b1',
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.buildingId).toBe('b1');
    expect(body.unitId).toBeUndefined();
  });

  it('sends clientId for CLIENT_MANAGER invitations', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ invitation: { status: 'PENDING' } }));
    vi.stubGlobal('fetch', fetchMock);

    await createUserInvitation({
      email: 'manager@example.com',
      name: 'Manager Invitado',
      internalRole: 'CLIENT_MANAGER',
      clientId: 'client_001',
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.clientId).toBe('client_001');
    expect(body.buildingId).toBeUndefined();
    expect(body.unitId).toBeUndefined();
  });

  it('sends unitId for OWNER and OCCUPANT invitations', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ invitation: { status: 'PENDING' } }));
    vi.stubGlobal('fetch', fetchMock);

    await createUserInvitation({
      email: 'occupant@example.com',
      name: 'Inquilina Invitada',
      internalRole: 'OCCUPANT',
      unitId: 'unit_201',
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.unitId).toBe('unit_201');
    expect(body.buildingId).toBeUndefined();
  });

  it('does not send clientId even if present in caller data', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ invitation: { status: 'PENDING' } }));
    vi.stubGlobal('fetch', fetchMock);

    await createUserInvitation({
      email: 'owner@example.com',
      name: 'Owner Invitada',
      internalRole: 'OWNER',
      unitId: 'unit_101',
      clientId: 'client_malicious',
    } as Parameters<typeof createUserInvitation>[0] & { clientId: string });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.clientId).toBeUndefined();
  });

  it.each([
    [403, 'No autorizado'],
    [409, 'Ese email ya existe; revisa si corresponde reactivar o reutilizar el usuario.'],
    [503, 'No hay proveedor de correo configurado para enviar invitaciónes.'],
  ])('propagates clear errors for HTTP %s', async (status, message) => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: message }, status)));

    await expect(
      createUserInvitation({
        email: 'owner@example.com',
        name: 'Owner Invitada',
        internalRole: 'OWNER',
        unitId: 'unit_101',
      })
    ).rejects.toThrow(message);
  });
});
