const ONBOARDING_KEY = "layers-onboarding-completed";

export function isOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

export function markOnboardingCompleted(): void {
  localStorage.setItem(ONBOARDING_KEY, "true");
}

export function resetOnboarding(): void {
  localStorage.removeItem(ONBOARDING_KEY);
}

export const ONBOARDING_STEPS = [
  { id: "welcome", title: "Welcome", path: "/onboarding" },
  { id: "connect-tools", title: "Connect Tools", path: "/onboarding/connect-tools" },
  { id: "choose-template", title: "Choose Template", path: "/onboarding/choose-template" },
  { id: "first-session", title: "Create Session", path: "/onboarding/first-session" },
  { id: "complete", title: "Tour Complete", path: "/onboarding/complete" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];
