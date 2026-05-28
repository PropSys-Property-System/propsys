import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PasswordResetConfirmView, PasswordResetRequestView } from './password-reset.ui';

describe('PasswordResetRequestView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(async () => undefined),
      },
    });
  });

  it('bloquea submit sin email', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<PasswordResetRequestView />);

    fireEvent.click(screen.getByRole('button', { name: /enviar enlace/i }));

    expect(screen.getByText('Ingresa tu correo electronico.')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('muestra mensaje generico cuando request es éxitoso', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);
    render(<PasswordResetRequestView />);

    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar enlace/i }));

    await waitFor(() => {
      expect(screen.getByText('Si el correo existe, recibiras instrucciones para restablecer tu contraseña.')).toBeInTheDocument();
    });
  });

  it('muestra enlace de prueba copiable cuando backend devuelve resetLink', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        delivery: { resetLink: 'http://localhost/password-reset/confirm?token=dev-token' },
      }),
    } as Response);
    render(<PasswordResetRequestView />);

    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar enlace/i }));

    await waitFor(() => {
      expect(screen.getByText('Enlace de prueba')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('http://localhost/password-reset/confirm?token=dev-token')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /copiar enlace/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost/password-reset/confirm?token=dev-token');
  });

  it('muestra error claro cuando no hay provider de correo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'No provider' }),
    } as Response);
    render(<PasswordResetRequestView />);

    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar enlace/i }));

    await waitFor(() => {
      expect(screen.getByText(/No hay proveedor de correo configurado para enviar enlaces de recuperacion\./)).toBeInTheDocument();
    });
  });
});

describe('PasswordResetConfirmView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra error cuando falta token', () => {
    render(<PasswordResetConfirmView token="" />);

    expect(screen.getByText('Enlace invalido o incompleto.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument();
  });

  it('bloquea submit con contraseña debil', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<PasswordResetConfirmView token="secret-token" />);

    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'weak' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'weak' } });
    fireEvent.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    expect(screen.getByText('La contraseña debe tener al menos 12 caracteres, mayuscula, minuscula, numero, simbolo y no debe tener espacios.')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('bloquea submit si confirmacion no coincide', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<PasswordResetConfirmView token="secret-token" />);

    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'StrongPassword#2026' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'StrongPassword#2027' } });
    fireEvent.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('envia token y contraseña al endpoint y muestra éxito', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);
    render(<PasswordResetConfirmView token="secret-token" />);

    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'StrongPassword#2026' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'StrongPassword#2026' } });
    fireEvent.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    await waitFor(() => {
      expect(screen.getByText('Contraseña actualizada correctamente. Ya puedes iniciar sesión.')).toBeInTheDocument();
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'secret-token', password: 'StrongPassword#2026' }),
    });
    expect(screen.getByRole('link', { name: /ir a iniciar sesión/i })).toHaveAttribute('href', '/');
  });

  it('muestra error generico cuando el endpoint falla y no renderiza el token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Reset invalido o expirado.' }),
    } as Response);
    render(<PasswordResetConfirmView token="secret-token" />);

    expect(screen.queryByText('secret-token')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'StrongPassword#2026' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'StrongPassword#2026' } });
    fireEvent.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    await waitFor(() => {
      expect(screen.getByText('No pudimos restablecer la contraseña. Solicita un nuevo enlace.')).toBeInTheDocument();
    });
  });
});
