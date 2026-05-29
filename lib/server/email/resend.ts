import {
  renderInvitationEmailHtml,
  renderPasswordResetEmailHtml,
  type InvitationEmailTemplateInput,
  type PasswordResetEmailTemplateInput,
} from './templates';

type SendInvitationEmailInput = InvitationEmailTemplateInput & {
  to: string;
};

type SendPasswordResetEmailInput = PasswordResetEmailTemplateInput & {
  to: string;
};

const DEFAULT_FROM = 'PropSys <onboarding@resend.dev>';
const RESEND_EMAILS_API_URL = 'https://api.resend.com/emails';

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

function getRequiredResendApiKey() {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    throw new Error('No hay proveedor de correo configurado para enviar emails. Reemplaza re_xxxxxxxxx por tu API key real de Resend.');
  }
  return apiKey;
}

export function isEmailProviderConfigured() {
  return Boolean(getResendApiKey());
}

export function shouldExposeEmailDebugLinks() {
  return process.env.NODE_ENV !== 'production' || process.env.PROPSYS_EXPOSE_AUTH_TOKENS === '1';
}

async function sendResendEmail(input: { from: string; to: string; subject: string; html: string }) {
  const apiKey = getRequiredResendApiKey();
  const res = await fetch(RESEND_EMAILS_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`No se pudo enviar email via Resend. Status: ${res.status}`);
  }
}

export async function sendInvitationEmail(input: SendInvitationEmailInput) {
  const subject = `Invitación a PropSys para ${input.internalRole}`;

  await sendResendEmail({
    from: getFromEmail(),
    to: input.to,
    subject,
    html: renderInvitationEmailHtml(input),
  });
}

export async function sendPasswordResetEmail(input: SendPasswordResetEmailInput) {
  await sendResendEmail({
    from: getFromEmail(),
    to: input.to,
    subject: 'Recuperación de contraseña de PropSys',
    html: renderPasswordResetEmailHtml(input),
  });
}
