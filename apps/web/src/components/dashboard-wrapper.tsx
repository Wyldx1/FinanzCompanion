'use client';

import { useState } from 'react';
import { Onboarding } from './onboarding';

interface DashboardWrapperProps {
  children: React.ReactNode;
  initialOnboardingComplete: boolean;
}

export function DashboardWrapper({
  children,
  initialOnboardingComplete
}: DashboardWrapperProps) {
  const [showOnboarding, setShowOnboarding] = useState(!initialOnboardingComplete);

  function handleOnboardingComplete() {
    setShowOnboarding(false);
  }

  return (
    <>
      {showOnboarding && (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}
      {children}
    </>
  );
}
