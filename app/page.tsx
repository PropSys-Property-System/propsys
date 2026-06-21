import React from 'react';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingProblemReveal } from '@/components/landing/LandingProblemReveal';
import { LandingFlow } from '@/components/landing/LandingFlow';
import { LandingRoles } from '@/components/landing/LandingRoles';
import { LandingSecurity } from '@/components/landing/LandingSecurity';
import { LandingFAQ } from '@/components/landing/LandingFAQ';
import { LandingCTA } from '@/components/landing/LandingCTA';
import { LandingFooter } from '@/components/landing/LandingFooter';

// Public landing page — no auth required.
// The login page now lives at /login.
export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main>
        <LandingHero />
        <LandingProblemReveal />
        <LandingFlow />
        <LandingRoles />
        <LandingSecurity />
        <LandingFAQ />
        <LandingCTA />
      </main>
      <LandingFooter />
    </>
  );
}
