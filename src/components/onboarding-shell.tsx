"use client";

import { ONBOARDING_STEPS, type OnboardingStepId } from "@/lib/onboarding";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface OnboardingShellProps {
  currentStep: OnboardingStepId;
  children: React.ReactNode;
}

export function OnboardingShell({ currentStep, children }: OnboardingShellProps) {
  const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.id === currentStep);
  const progress = ((currentIndex + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <div className="w-full max-w-lg space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Step indicators */}
      <div className="space-y-3">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Step {currentIndex + 1} of {ONBOARDING_STEPS.length}</span>
          <span>{ONBOARDING_STEPS[currentIndex].title}</span>
        </div>
        <Progress value={progress} className="h-1.5" />
        <div className="flex justify-between gap-1">
          {ONBOARDING_STEPS.map((step, i) => (
            <div
              key={step.id}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-300",
                i <= currentIndex ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="animate-in fade-in slide-in-from-right-4 duration-400">
        {children}
      </div>
    </div>
  );
}
