export type InvitationEmailTemplateInput = {
  name: string;
  inviteLink: string;
  internalRole: string;
  expiresAt: string;
};

export type PasswordResetEmailTemplateInput = {
  resetLink: string;
  expiresAt: string;
};

const HTML_ESCAPE_CHARS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_CHARS[char]);
}

function formatExpiration(expiresAt: string): string {
  return escapeHtml(new Date(expiresAt).toLocaleString('es-PE'));
}

export function renderInvitationEmailHtml(input: InvitationEmailTemplateInput): string {
  const name = escapeHtml(input.name);
  const inviteLink = escapeHtml(input.inviteLink);
  const internalRole = escapeHtml(input.internalRole);
  const expiresAt = formatExpiration(input.expiresAt);

  return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin-bottom: 12px;">Te invitaron a PropSys</h2>
        <p>Hola ${name},</p>
        <p>Se creo una invitación para que accedas a <strong>PropSys</strong> con el rol <strong>${internalRole}</strong>.</p>
        <p>Para completar tu acceso, usa este enlace:</p>
        <p style="margin: 20px 0;">
          <a href="${inviteLink}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 700;">
            Aceptar invitación
          </a>
        </p>
        <p>Si el boton no funciona, copia y pega este enlace en tu navegador:</p>
        <p><a href="${inviteLink}">${inviteLink}</a></p>
        <p>La invitación vence el ${expiresAt}.</p>
      </div>
    `;
}

export function renderPasswordResetEmailHtml(input: PasswordResetEmailTemplateInput): string {
  const resetLink = escapeHtml(input.resetLink);
  const expiresAt = formatExpiration(input.expiresAt);

  return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin-bottom: 12px;">Restablece tu contraseña</h2>
        <p>Recibimos una solicitud para cambiar la contraseña de tu cuenta en <strong>PropSys</strong>.</p>
        <p>Usa este enlace para continuar:</p>
        <p style="margin: 20px 0;">
          <a href="${resetLink}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 700;">
            Restablecer contraseña
          </a>
        </p>
        <p>Si el boton no funciona, copia y pega este enlace en tu navegador:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>Este enlace vence el ${expiresAt}.</p>
      </div>
    `;
}
