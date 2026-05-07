"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { OnboardingShell } from "@/components/onboarding-shell";
import { TemplateSelector } from "@/components/template-selector";

export default function ChooseTemplatePage() {
  const router = useRouter();

  function handleNext() {
    router.push("/onboarding/first-session");
  }

  return (
    <OnboardingShell currentStep="choose-template">
      <Card>
        <CardContent className="pt-6">
          <TemplateSelector
            onApplied={handleNext}
            onSkip={handleNext}
          />
        </CardContent>
      </Card>
    </OnboardingShell>
  );
}
