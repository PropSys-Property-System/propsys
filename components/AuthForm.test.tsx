import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthForm } from './AuthForm';

const loginMock = vi.fn(async () => undefined);
const TEST_PASSWORD_INPUT = 'StrongPassword#2026';

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    login: loginMock,
    isLoading: false,
  }),
}));

describe('AuthForm', () => {
  beforeEach(() => {
    loginMock.mockReset();
    loginMock.mockResolvedValue(undefined);
  });

  it('renderiza campos de email y contraseña', () => {
    render(<AuthForm />);

    expect(screen.getByPlaceholderText(/correo electr/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/contrase/i)).toBeInTheDocument();
  });

  it('permite escribir email y contraseña', () => {
    render(<AuthForm />);

    const email = screen.getByPlaceholderText(/correo electr/i) as HTMLInputElement;
    const password = screen.getByPlaceholderText(/contrase/i) as HTMLInputElement;

    fireEvent.change(email, { target: { value: 'manager@propsys.com' } });
    fireEvent.change(password, { target: { value: TEST_PASSWORD_INPUT } });

    expect(email).toHaveValue('manager@propsys.com');
    expect(password).toHaveValue(TEST_PASSWORD_INPUT);
  });

  it('envia email y contraseña al flujo de login', async () => {
    render(<AuthForm />);

    fireEvent.change(screen.getByPlaceholderText(/correo electr/i), {
      target: { value: 'manager@propsys.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/contrase/i), {
      target: { value: TEST_PASSWORD_INPUT },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar ahora/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('manager@propsys.com', TEST_PASSWORD_INPUT);
    });
  });

  it('muestra error de login si las credenciales fallan', async () => {
    loginMock.mockRejectedValueOnce(new Error('Credenciales invalidas'));
    render(<AuthForm />);

    fireEvent.change(screen.getByPlaceholderText(/correo electr/i), {
      target: { value: 'manager@propsys.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/contrase/i), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar ahora/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales invalidas');
  });

  it('muestra enlace para recuperar contraseña', () => {
    render(<AuthForm />);

    const link = screen.getByRole('link', { name: /olvid/i });
    expect(link).toHaveAttribute('href', '/password-reset/request');
  });
});
