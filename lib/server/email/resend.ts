import { Resend } from 'resend';

type SendInvitationEmailInput = {
  to: string;
  name: string;
  inviteLink: string;
  internalRole: string;
  expiresAt: string;
};

type SendPasswordResetEmailInput = {
  to: string;
  resetLink: string;
  expiresAt: string;
};

const DEFAULT_FROM = 'PropSys <onboarding@resend.dev>';

function getResendApiKey() {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? '';
  if (!apiKey || apiKey === 're_xxxxxxxxx') {
    return null;
  }
  return apiKey;
}

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
}

function getResendClient() {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    throw new Error('No hay proveedor de correo configurado para enviar emails. Reemplaza re_xxxxxxxxx por tu API key real de Resend.');
  }
  return new Resend(apiKey);
}

export function isEmailProviderConfigured() {
  return Boolean(getResendApiKey());
}

export function shouldExposeEmailDebugLinks() {
  return process.env.NODE_ENV !== 'production' || process.env.PROPSYS_EXPOSE_AUTH_TOKENS === '1';
}

export async function sendInvitationEmail(input: SendInvitationEmailInput) {
  const resend = getResendClient();
  const subject = `Invitacion a PropSys para ${input.internalRole}`;

  await resend.emails.send({
    from: getFromEmail(),
    to: input.to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin-bottom: 12px;">Te invitaron a PropSys</h2>
        <p>Hola ${input.name},</p>
        <p>Se creo una invitacion para que accedas a <strong>PropSys</strong> con el rol <strong>${input.internalRole}</strong>.</p>
        <p>Para completar tu acceso, usa este enlace:</p>
        <p style="margin: 20px 0;">
          <a href="${input.inviteLink}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 700;">
            Aceptar invitacion
          </a>
        </p>
        <p>Si el boton no funciona, copia y pega este enlace en tu navegador:</p>
        <p><a href="${input.inviteLink}">${input.inviteLink}</a></p>
        <p>La invitacion vence el ${new Date(input.expiresAt).toLocaleString('es-PE')}.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(input: SendPasswordResetEmailInput) {
  const resend = getResendClient();

  await resend.emails.send({
    from: getFromEmail(),
    to: input.to,
    subject: 'Recuperacion de contrasena de PropSys',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin-bottom: 12px;">Restablece tu contrasena</h2>
        <p>Recibimos una solicitud para cambiar la contrasena de tu cuenta en <strong>PropSys</strong>.</p>
        <p>Usa este enlace para continuar:</p>
        <p style="margin: 20px 0;">
          <a href="${input.resetLink}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 700;">
            Restablecer contrasena
          </a>
        </p>
        <p>Si el boton no funciona, copia y pega este enlace en tu navegador:</p>
        <p><a href="${input.resetLink}">${input.resetLink}</a></p>
        <p>Este enlace vence el ${new Date(input.expiresAt).toLocaleString('es-PE')}.</p>
      </div>
    `,
  });
}
