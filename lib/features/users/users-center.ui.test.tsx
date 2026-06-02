import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UserCard } from './users-center.ui';
import type { User } from '@/lib/types';

const currentUser: User = {
  id: 'u_manager',
  email: 'manager@propsys.com',
  name: 'Manager',
  role: 'MANAGER',
  internalRole: 'CLIENT_MANAGER',
  clientId: 'client_001',
  scope: 'client',
  status: 'ACTIVE',
};

const activeUser: User = {
  id: 'u_owner',
  email: 'owner.with.a.long.email@example.com',
  name: 'Alice Owner',
  role: 'RESIDENT',
  internalRole: 'OWNER',
  clientId: 'client_001',
  scope: 'client',
  status: 'ACTIVE',
  buildingId: 'b1',
  unitId: 'unit_101',
};

function renderCard(targetUser: User = activeUser) {
  const onEdit = vi.fn();
  const onStatusChange = vi.fn();
  render(
    <UserCard
      currentUser={currentUser}
      targetUser={targetUser}
      buildings={new Map([['b1', 'Torre Norte']])}
      units={new Map([['unit_101', 'Depto 101']])}
      pendingUserId={null}
      onEdit={onEdit}
      onStatusChange={onStatusChange}
    />
  );
  return { onEdit, onStatusChange };
}

describe('UserCard responsive actions', () => {
  it('keeps direct actions for desktop and exposes a compact mobile menu trigger', () => {
    renderCard();

    expect(screen.getByTestId('desktop-user-actions')).toHaveClass('hidden', 'md:flex');
    expect(screen.getByRole('button', { name: 'Acciones para Alice Owner' })).toHaveClass('md:hidden');
  });

  it('opens an accessible mobile menu with edit and suspend actions for active users', () => {
    renderCard();

    const trigger = screen.getByRole('button', { name: 'Acciones para Alice Owner' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('menu', { name: 'Acciones para Alice Owner' });
    expect(within(menu).getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Suspender' })).toBeInTheDocument();
  });

  it('shows reactivate for suspended users and closes the menu after executing callbacks', () => {
    const { onEdit, onStatusChange } = renderCard({ ...activeUser, status: 'SUSPENDED' });
    const trigger = screen.getByRole('button', { name: 'Acciones para Alice Owner' });

    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Editar' }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'u_owner' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Reactivar' }));
    expect(onStatusChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'u_owner' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
