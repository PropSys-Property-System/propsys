import React, { Suspense } from 'react';
import LoginContent from './LoginContent';

// useSearchParams() inside LoginContent requires a Suspense boundary.
// This Server Component provides it.
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
