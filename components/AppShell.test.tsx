import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/dashboard',
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockUserBase = {
  id: 'u1',
  email: 'test@propsys.com',
  name: 'Test User',
  scope: 'global',
  status: 'ACTIVE',
};

let mockUser: Record<string, unknown> | null = null;

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn(),
  }),
}));

describe('AppShell', () => {
  beforeEach(() => {
    mockUser = null;
    vi.clearAllMocks();
  });

  it('renders Clientes link for ROOT_ADMIN', () => {
    mockUser = { ...mockUserBase, role: 'MANAGER', internalRole: 'ROOT_ADMIN' };
    render(<AppShell>Content</AppShell>);

    expect(screen.getByRole('link', { name: /Clientes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Invitaciones/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('title', 'Abrir menú');
  });

  it('hides Clientes link for CLIENT_MANAGER but shows Invitaciones', () => {
    mockUser = { ...mockUserBase, role: 'MANAGER', internalRole: 'CLIENT_MANAGER' };
    render(<AppShell>Content</AppShell>);

    expect(screen.queryByRole('link', { name: /Clientes/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Invitaciones/i })).toBeInTheDocument();
  });
});
