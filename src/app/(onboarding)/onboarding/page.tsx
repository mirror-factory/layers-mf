"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OnboardingShell } from "@/components/onboarding-shell";

export default function WelcomePage() {
  const router = useRouter();

  return (
    <OnboardingShell currentStep="welcome">
      <Card>
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
            ✦
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome to Layers</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your AI-powered workspace for context-rich collaboration.
              Let&apos;s get you set up in just a few steps.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <span className="mt-0.5 text-primary">1</span>
            <div>
              <p className="font-medium text-foreground">Connect your tools</p>
              <p>Sync meetings, issues, and docs from your existing workflow.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <span className="mt-0.5 text-primary">2</span>
            <div>
              <p className="font-medium text-foreground">Create your first session</p>
              <p>Start a collaborative session with AI-powered context.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <span className="mt-0.5 text-primary">3</span>
            <div>
              <p className="font-medium text-foreground">You&apos;re ready</p>
              <p>Explore the dashboard and start building with your team.</p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            onClick={() => router.push("/onboarding/connect-tools")}
          >
            Get started
          </Button>
        </CardFooter>
      </Card>
    </OnboardingShell>
  );
}
