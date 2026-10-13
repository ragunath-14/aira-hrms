"use client";

import { OnboardingView } from "@/components/features/onboarding-view";
import { useIsHr } from "@/hooks/use-is-hr";

export default function Page() {
  const isHr = useIsHr();

  if (isHr === null) return null;

  return <OnboardingView isHr={isHr} />;
}
