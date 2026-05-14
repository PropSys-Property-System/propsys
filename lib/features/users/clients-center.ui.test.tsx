import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientCard } from './clients-center.ui';
import type { ClientAccount } from '@/lib/repos/core/clients.repo';

const activeClient: ClientAccount = {
  id: 'c1',
  name: 'Empresa Activa',
  status: 'ACTIVE',
  createdAt: '2026-05-01',
};

const suspendedClient: ClientAccount = {
  id: 'c2',
  name: 'Empresa Suspendida',
  status: 'SUSPENDED',
  createdAt: '2026-05-02',
};

describe('clients center ui', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an active client card with suspend and edit actions', () => {
    const onEdit = vi.fn();
    const onStatusChange = vi.fn();
    render(<ClientCard client={activeClient} pendingClientId={null} onEdit={onEdit} onStatusChange={onStatusChange} />);

    expect(screen.getByText('Empresa Activa')).toBeInTheDocument();
    expect(screen.getByText('ID: c1')).toBeInTheDocument();
    expect(screen.queryByText('SUSPENDIDO')).not.toBeInTheDocument();

    const editBtn = screen.getByTitle('Editar cliente');
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(activeClient);

    const suspendBtn = screen.getByTitle('Suspender cliente');
    fireEvent.click(suspendBtn);
    expect(onStatusChange).toHaveBeenCalledWith(activeClient);
  });

  it('renders a suspended client card with reactivate action and no edit action', () => {
    const onEdit = vi.fn();
    const onStatusChange = vi.fn();
    render(<ClientCard client={suspendedClient} pendingClientId={null} onEdit={onEdit} onStatusChange={onStatusChange} />);

    expect(screen.getByText('Empresa Suspendida')).toBeInTheDocument();
    expect(screen.getByText('ID: c2')).toBeInTheDocument();
    expect(screen.getByText('SUSPENDIDO')).toBeInTheDocument();

    expect(screen.queryByTitle('Editar cliente')).not.toBeInTheDocument();

    const reactivateBtn = screen.getByTitle('Reactivar cliente');
    fireEvent.click(reactivateBtn);
    expect(onStatusChange).toHaveBeenCalledWith(suspendedClient);
  });

  it('disables actions when client is pending', () => {
    render(<ClientCard client={activeClient} pendingClientId="c1" onEdit={vi.fn()} onStatusChange={vi.fn()} />);
    expect(screen.getByTitle('Editar cliente')).toBeDisabled();
    expect(screen.getByTitle('Suspender cliente')).toBeDisabled();
  });
});
