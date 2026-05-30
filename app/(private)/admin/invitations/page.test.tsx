import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminInvitationsPage from './page';

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'u_manager',
      email: 'manager@propsys.local',
      name: 'Manager',
      role: 'MANAGER',
      internalRole: 'CLIENT_MANAGER',
      clientId: 'client_001',
      scope: 'client',
      status: 'ACTIVE',
    },
  }),
}));

describe('admin invitations page polish', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the shared loading state while invitations load', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => undefined));

    const { container } = render(<AdminInvitationsPage />);

    expect(screen.getByText('Cargando invitaciones...')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('uses the shared empty state when there are no pending invitations', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    render(<AdminInvitationsPage />);

    expect(await screen.findByRole('heading', { name: 'Sin invitaciones pendientes' })).toBeInTheDocument();
    expect(screen.getByText('No hay invitaciones pendientes por aceptar.')).toBeInTheDocument();
  });

  it('renders translated roles and normalized visible copy', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'invite_1',
            email: 'admin@propsys.local',
            clientId: 'client_001',
            status: 'PENDING',
            expiresAt: '2099-01-01T00:00:00.000Z',
            createdAt: '2026-01-01T00:00:00.000Z',
            name: 'Admin Demo',
            role: 'ADMIN',
            internalRole: 'BUILDING_ADMIN',
          },
        ],
      }),
    } as Response);

    render(<AdminInvitationsPage />);

    expect(await screen.findByRole('heading', { name: 'Invitaciones pendientes' })).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.queryByText('ADMIN')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reemitir enlace/i })).toBeInTheDocument();
  });
});
