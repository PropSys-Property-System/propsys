'use client';

import React, { useEffect, useState } from "react";
import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/lib/auth/auth-context";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const router = useRouter();
  const [hasResolvedSession, setHasResolvedSession] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'MANAGER' || user.role === 'BUILDING_ADMIN') {
        router.push('/admin/dashboard');
      } else if (user.role === 'STAFF') {
        router.push('/staff/tasks');
      } else {
        router.push('/resident/receipts');
      }
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    if (!isLoading) {
      setHasResolvedSession(true);
    }
  }, [isLoading]);

  if (!hasResolvedSession && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <AuthForm />
    </div>
  );
}

