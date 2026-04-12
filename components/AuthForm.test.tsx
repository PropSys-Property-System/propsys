import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthForm } from './AuthForm';

const loginMock = vi.fn(async () => undefined);

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ login: loginMock, isLoading: false }),
}));

vi.mock('lucide-react', () => ({
  Mail: () => <div />,
  Loader2: () => <div />,
  ArrowRight: () => <div />,
  ShieldCheck: () => <div />,
}));

describe('AuthForm (QA demo accounts)', () => {
  it('renders email and password fields', async () => {
    render(<AuthForm />);
    expect(screen.getByPlaceholderText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Contraseña')).toBeInTheDocument();
  });

  it('submits email/password and calls login', async () => {
    render(<AuthForm />);

    const email = screen.getByPlaceholderText('Correo electrónico') as HTMLInputElement;
    const password = screen.getByPlaceholderText('Contraseña') as HTMLInputElement;
    fireEvent.change(email, { target: { value: 'manager@propsys.com' } });
    fireEvent.change(password, { target: { value: 'PropsysQA#2026' } });

    fireEvent.click(screen.getByRole('button', { name: 'Entrar ahora' }));
    expect(loginMock).toHaveBeenCalledWith('manager@propsys.com', 'PropsysQA#2026');
  });

  it('shows backend error messages when login fails', async () => {
    loginMock.mockRejectedValueOnce(new Error('Usuario inactivo'));
    render(<AuthForm />);

    fireEvent.change(screen.getByPlaceholderText('Correo electrónico'), {
      target: { value: 'inactive@propsys.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Contraseña'), {
      target: { value: 'PropsysQA#2026' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Entrar ahora' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario inactivo');
  });
});

