'use client';

import React, { useState } from 'react';
import {
  ResetPasswordRequestView,
  ResetPasswordShell,
  ResetPasswordSuccessView,
} from '@/lib/features/auth/reset-password.ui';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email) return;

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsLoading(false);
    setIsSent(true);
  };

  return (
    <ResetPasswordShell>
      {isSent ? (
        <ResetPasswordSuccessView email={email} />
      ) : (
        <ResetPasswordRequestView
          email={email}
          isLoading={isLoading}
          onEmailChange={setEmail}
          onSubmit={handleSubmit}
        />
      )}
    </ResetPasswordShell>
  );
}
