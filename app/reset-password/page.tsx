import { PasswordResetConfirmView, PasswordResetRequestView } from '@/lib/features/auth/password-reset.ui';

type LegacyResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string | string[];
  }>;
};

export default async function LegacyResetPasswordPage({ searchParams }: LegacyResetPasswordPageProps) {
  const params = await searchParams;
  const tokenParam = params?.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] ?? '' : tokenParam ?? '';

  if (token) return <PasswordResetConfirmView token={token} />;
  return <PasswordResetRequestView />;
}
