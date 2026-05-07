"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isOnboardingCompleted } from "@/lib/onboarding";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isOnboardingCompleted() && pathname !== "/onboarding/complete") {
      router.replace("/");
    }
  }, [router, pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4 overflow-y-auto">
      {children}
    </div>
  );
}
