import { PasswordResetConfirmView } from '@/lib/features/auth/password-reset.ui';

type PasswordResetConfirmPageProps = {
  searchParams?: Promise<{
    token?: string | string[];
  }>;
};

export default async function PasswordResetConfirmPage({ searchParams }: PasswordResetConfirmPageProps) {
  const params = await searchParams;
  const tokenParam = params?.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] ?? '' : tokenParam ?? '';

  return <PasswordResetConfirmView token={token} />;
}
