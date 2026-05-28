import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvitationAcceptView } from './invitation-accept.ui';

describe('InvitationAcceptView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra error cuando falta el token', () => {
    render(<InvitationAcceptView token="" />);

    expect(screen.getByText('Invitación inválida o incompleta.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
  });

  it('bloquea submit con contraseña débil', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<InvitationAcceptView token="secret-token" />);

    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'weak' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'weak' } });
    fireEvent.click(screen.getByRole('button', { name: /activar cuenta/i }));

    expect(screen.getByText('La contraseña debe tener al menos 12 caracteres, mayúscula, minúscula, número, símbolo y no debe tener espacios.')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('bloquea submit si la confirmación no coincide', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<InvitationAcceptView token="secret-token" />);

    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'StrongPassword#2026' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'StrongPassword#2027' } });
    fireEvent.click(screen.getByRole('button', { name: /activar cuenta/i }));

    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('envía token y contraseña al endpoint y muestra éxito', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);
    render(<InvitationAcceptView token="secret-token" />);

    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'StrongPassword#2026' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'StrongPassword#2026' } });
    fireEvent.click(screen.getByRole('button', { name: /activar cuenta/i }));

    await waitFor(() => {
      expect(screen.getByText('Cuenta activada correctamente. Ya puedes iniciar sesión.')).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/invitations/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'secret-token', password: 'StrongPassword#2026' }),
    });
    const loginLink = screen.getByRole('link', { name: /ir a iniciar sesión/i });
    expect(loginLink).toHaveAttribute('href', '/');
    expect(loginLink).not.toHaveAttribute('href', '/login');
  });

  it('muestra error genérico cuando el endpoint falla', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invitación invalida o expirada.' }),
    } as Response);
    render(<InvitationAcceptView token="secret-token" />);

    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'StrongPassword#2026' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'StrongPassword#2026' } });
    fireEvent.click(screen.getByRole('button', { name: /activar cuenta/i }));

    await waitFor(() => {
      expect(screen.getByText('No pudimos activar la cuenta. Revisa el enlace o solicita una nueva invitación.')).toBeInTheDocument();
    });
  });

  it('no muestra el token en pantalla', () => {
    render(<InvitationAcceptView token="secret-token" />);

    expect(screen.queryByText('secret-token')).not.toBeInTheDocument();
  });
});
