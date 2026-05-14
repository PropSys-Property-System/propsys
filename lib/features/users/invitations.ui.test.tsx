import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState, type ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvitationCreationDialog } from './invitations.ui';
import type { CreateUserInvitationResult, UserInvitationRole } from './invitations.data';
import type { Building, Unit } from '@/lib/types';

const buildings: Building[] = [
  { id: 'b1', clientId: 'client_001', name: 'Torre Norte', address: 'Av. 1', city: 'Lima' },
];

const units: Unit[] = [
  { id: 'unit_101', clientId: 'client_001', buildingId: 'b1', number: '101' },
];

const clients = [{ id: 'client_001', slug: 'cliente-uno', name: 'Cliente Uno', status: 'ACTIVE' }];
const allRoles: UserInvitationRole[] = ['CLIENT_MANAGER', 'BUILDING_ADMIN', 'STAFF', 'OWNER', 'OCCUPANT'];

function renderDialog(options: Partial<ComponentProps<typeof InvitationCreationDialog>> = {}) {
  const createInvitation = vi.fn(async (): Promise<CreateUserInvitationResult> => ({
    user: {
      id: 'u_invited',
      email: 'owner@example.com',
      name: 'Owner Invitada',
      role: 'OWNER',
      internalRole: 'OWNER',
      clientId: 'client_001',
      scope: 'client',
      status: 'INACTIVE',
      unitId: 'unit_101',
    },
    invitation: { id: 'inv_1', status: 'PENDING', expiresAt: '2026-05-12T00:00:00.000Z' },
    delivery: {
      mode: 'development_link',
      inviteLink: 'http://localhost/invitations/accept?token=link-token',
      token: 'raw-secret-token',
    },
  }));
  const onClose = vi.fn();
  const onInvitationCreated = vi.fn();

  render(
    <InvitationCreationDialog
      isOpen
      title="Invitar usuario"
      description="Crea una invitacion para activar la cuenta."
      roleOptions={allRoles}
      clients={clients}
      buildings={buildings}
      units={units}
      createInvitation={createInvitation}
      onClose={onClose}
      onInvitationCreated={onInvitationCreated}
      {...options}
    />
  );

  return { createInvitation, onClose, onInvitationCreated };
}

describe('InvitationCreationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows all allowed invitation roles for a root admin context', () => {
    renderDialog();

    expect(screen.getByRole('option', { name: 'Manager de cliente' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Administrador de edificio' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Staff' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Propietario' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Inquilino' })).toBeInTheDocument();
  });

  it('limits building admin staff context to STAFF invitations', () => {
    renderDialog({ roleOptions: ['STAFF'], defaultRole: 'STAFF' });

    expect(screen.getByRole('option', { name: 'Staff' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Propietario' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Inquilino' })).not.toBeInTheDocument();
  });

  it('requires a client for CLIENT_MANAGER invitations', () => {
    renderDialog({ roleOptions: ['CLIENT_MANAGER'], defaultRole: 'CLIENT_MANAGER', clients: [] });

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Manager Invitado' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'manager@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar invitacion/i }));

    expect(screen.getByText('Selecciona un cliente para ese rol.')).toBeInTheDocument();
  });

  it('requires a unit for OWNER and OCCUPANT invitations', () => {
    renderDialog({ roleOptions: ['OWNER'], defaultRole: 'OWNER', units: [] });

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Owner Invitada' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar invitacion/i }));

    expect(screen.getByText('Selecciona una unidad para ese rol.')).toBeInTheDocument();
  });

  it('requires a building for STAFF and BUILDING_ADMIN invitations', () => {
    renderDialog({ roleOptions: ['STAFF'], defaultRole: 'STAFF', buildings: [], defaultBuildingId: '' });

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Staff Invitado' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'staff@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar invitacion/i }));

    expect(screen.getByText('Selecciona un edificio para ese rol.')).toBeInTheDocument();
  });

  it('does not render a password field', () => {
    renderDialog();

    expect(screen.queryByLabelText(/contrasena/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/contrasena/i)).not.toBeInTheDocument();
  });

  it('shows a copyable invite link after a successful submit without rendering the raw token separately', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { createInvitation, onInvitationCreated } = renderDialog({ defaultRole: 'OWNER' });

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Owner Invitada' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('Unidad'), { target: { value: 'unit_101' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar invitacion/i }));

    await waitFor(() => {
      expect(screen.getByText('Invitacion creada')).toBeInTheDocument();
    });
    expect(screen.getByText('http://localhost/invitations/accept?token=link-token')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /copiar enlace/i }));
    expect(writeText).toHaveBeenCalledWith('http://localhost/invitations/accept?token=link-token');
    expect(screen.queryByText('raw-secret-token')).not.toBeInTheDocument();
    expect(createInvitation).toHaveBeenCalledWith({
      email: 'owner@example.com',
      name: 'Owner Invitada',
      internalRole: 'OWNER',
      unitId: 'unit_101',
    });
    expect(onInvitationCreated).toHaveBeenCalledTimes(1);
  });

  it('submits CLIENT_MANAGER invitations with clientId and without building or unit', async () => {
    const { createInvitation } = renderDialog({ roleOptions: ['CLIENT_MANAGER'], defaultRole: 'CLIENT_MANAGER' });

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Manager Invitado' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'manager@example.com' } });
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'client_001' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar invitacion/i }));

    await waitFor(() => {
      expect(createInvitation).toHaveBeenCalledWith({
        email: 'manager@example.com',
        name: 'Manager Invitado',
        internalRole: 'CLIENT_MANAGER',
        clientId: 'client_001',
      });
    });
  });

  it('keeps the success link visible when parent state updates after invitation creation', async () => {
    const createInvitation = vi.fn(async (): Promise<CreateUserInvitationResult> => ({
      user: {
        id: 'u_invited',
        email: 'owner@example.com',
        name: 'Owner Invitada',
        role: 'OWNER',
        internalRole: 'OWNER',
        clientId: 'client_001',
        scope: 'client',
        status: 'INACTIVE',
        unitId: 'unit_101',
      },
      invitation: { id: 'inv_1', status: 'PENDING', expiresAt: '2026-05-12T00:00:00.000Z' },
      delivery: {
        mode: 'development_link',
        inviteLink: 'http://localhost/invitations/accept?token=link-token',
        token: 'raw-secret-token',
      },
    }));

    function ParentWithInlineRoleOptions() {
      const [createdCount, setCreatedCount] = useState(0);

      return (
        <>
          <span>Invitaciones creadas: {createdCount}</span>
          <InvitationCreationDialog
            isOpen
            title="Invitar usuario"
            description="Crea una invitacion para activar la cuenta."
            roleOptions={['OWNER']}
            defaultRole="OWNER"
            buildings={buildings}
            units={units}
            createInvitation={createInvitation}
            onClose={vi.fn()}
            onInvitationCreated={() => setCreatedCount((current) => current + 1)}
          />
        </>
      );
    }

    render(<ParentWithInlineRoleOptions />);

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Owner Invitada' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('Unidad'), { target: { value: 'unit_101' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar invitacion/i }));

    await waitFor(() => {
      expect(screen.getByText('Invitaciones creadas: 1')).toBeInTheDocument();
    });
    expect(screen.getByText('Invitacion creada')).toBeInTheDocument();
    expect(screen.getByText('http://localhost/invitations/accept?token=link-token')).toBeInTheDocument();
  });

  it('shows a clear email provider error for 503 responses', async () => {
    renderDialog({
      defaultRole: 'OWNER',
      createInvitation: vi.fn(async () => {
        throw new Error('No hay proveedor de correo configurado para enviar invitaciones.');
      }),
    });

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Owner Invitada' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('Unidad'), { target: { value: 'unit_101' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar invitacion/i }));

    await waitFor(() => {
      expect(screen.getByText('No hay proveedor de correo configurado para enviar invitaciones.')).toBeInTheDocument();
    });
  });
});
