'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SETUP_STEPS,
  SetupConfirmationStep,
  SetupFrame,
  SetupProfileStep,
  SetupPropertyStep,
} from '@/lib/features/bootstrap/app-bootstrap.ui';

export default function SetupPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleNext = async () => {
    if (currentStep === SETUP_STEPS.length - 1) {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      router.push('/router');
      return;
    }

    setCurrentStep((previous) => previous + 1);
  };

  const handleBack = () => {
    setCurrentStep((previous) => Math.max(0, previous - 1));
  };

  let stepContent: React.ReactNode = null;
  if (currentStep === 0) stepContent = <SetupProfileStep />;
  if (currentStep === 1) stepContent = <SetupPropertyStep />;
  if (currentStep === 2) stepContent = <SetupConfirmationStep />;

  return (
    <SetupFrame
      currentStep={currentStep}
      steps={SETUP_STEPS}
      isLoading={isLoading}
      onBack={handleBack}
      onNext={handleNext}
    >
      {stepContent}
    </SetupFrame>
  );
}
