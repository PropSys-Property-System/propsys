import { InvitationAcceptView } from '@/lib/features/auth/invitation-accept.ui';

type InvitationAcceptPageProps = {
  searchParams?: Promise<{
    token?: string | string[];
  }>;
};

export default async function InvitationAcceptPage({ searchParams }: InvitationAcceptPageProps) {
  const params = await searchParams;
  const tokenParam = params?.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] ?? '' : tokenParam ?? '';

  return <InvitationAcceptView token={token} />;
}
