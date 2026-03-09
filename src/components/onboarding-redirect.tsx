"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isOnboardingCompleted } from "@/lib/onboarding";

export function OnboardingRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!isOnboardingCompleted()) {
      router.replace("/onboarding");
    }
  }, [router]);

  return null;
}
