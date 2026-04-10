"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Mic, BookOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortalOnboardingProps {
  clientName?: string;
  brandColor?: string;
  isDark?: boolean;
}

const STEPS = [
  {
    icon: BookOpen,
    title: "Browse Your Documents",
    description:
      "All your proposal documents are organized in the Library. Click any document to open and review it.",
  },
  {
    icon: MessageSquare,
    title: "Ask Questions Anytime",
    description:
      "Use the chat to ask about any section — budgets, timelines, deliverables. The AI has read everything for you.",
  },
  {
    icon: Mic,
    title: "Just Talk",
    description:
      "Tap the mic and speak naturally. Ask to highlight sections, explain terms, or compare documents — all hands-free.",
  },
];

export function PortalOnboarding({
  clientName,
  brandColor = "#0DE4F2",
  isDark = false,
}: PortalOnboardingProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const sessionKey = `portal-onboarding-${clientName ?? "default"}`;

  useEffect(() => {
    if (sessionStorage.getItem(sessionKey)) return;
    // Show after welcome modal dismisses (3s delay)
    const timer = setTimeout(() => setVisible(true), 3500);
    return () => clearTimeout(timer);
  }, [sessionKey]);

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(sessionKey, "1");
    setTimeout(() => setVisible(false), 300);
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else dismiss();
  };

  if (!visible) return null;

  const currentStep = STEPS[step];
  const Icon = currentStep.icon;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[90] flex items-end md:items-center justify-center transition-opacity duration-300",
        dismissed ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
    >
      <div
        className={cn(
          "absolute inset-0",
          isDark ? "bg-black/40" : "bg-black/20"
        )}
        onClick={dismiss}
      />

      <div
        className={cn(
          "relative z-10 w-full max-w-sm mx-4 mb-4 md:mb-0 rounded-2xl p-6 shadow-2xl border transition-all",
          isDark
            ? "bg-[#1e2433] border-white/10"
            : "bg-white border-slate-200"
        )}
      >
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
        >
          <X
            className={cn(
              "h-4 w-4",
              isDark ? "text-white/40" : "text-slate-400"
            )}
          />
        </button>

        <div className="flex flex-col items-center text-center">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center mb-4"
            style={{ backgroundColor: `${brandColor}20` }}
          >
            <Icon className="h-6 w-6" style={{ color: brandColor }} />
          </div>

          <h3
            className={cn(
              "text-lg font-semibold mb-2",
              isDark ? "text-white" : "text-slate-900"
            )}
          >
            {currentStep.title}
          </h3>
          <p
            className={cn(
              "text-sm mb-6",
              isDark ? "text-white/60" : "text-slate-500"
            )}
          >
            {currentStep.description}
          </p>

          {/* Progress dots */}
          <div className="flex gap-2 mb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-6" : "w-1.5"
                )}
                style={{
                  backgroundColor:
                    i === step
                      ? brandColor
                      : isDark
                        ? "rgba(255,255,255,0.2)"
                        : "#e2e8f0",
                }}
              />
            ))}
          </div>

          <button
            onClick={next}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:brightness-110"
            style={{ backgroundColor: brandColor }}
          >
            {step < STEPS.length - 1 ? "Next" : "Get Started"}
          </button>
        </div>
      </div>
    </div>
  );
}
