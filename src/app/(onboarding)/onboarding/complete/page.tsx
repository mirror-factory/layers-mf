"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OnboardingShell } from "@/components/onboarding-shell";
import { markOnboardingCompleted } from "@/lib/onboarding";
import { Check, MessageSquare, BookOpen, Users } from "lucide-react";

export default function CompletePage() {
  const router = useRouter();

  function handleFinish() {
    markOnboardingCompleted();
    router.replace("/");
  }

  return (
    <OnboardingShell currentStep="complete">
      <Card>
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10">
            <Check className="h-8 w-8 text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">You&apos;re all set!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your workspace is ready. Here&apos;s what you can explore next.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">Chat with AI</p>
              <p className="text-muted-foreground">Ask questions, get summaries, and generate insights from your context.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">Build your context library</p>
              <p className="text-muted-foreground">Upload docs, connect integrations, and grow your knowledge base.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">Invite your team</p>
              <p className="text-muted-foreground">Collaborate in sessions and share context across your organization.</p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleFinish}>
            Go to dashboard
          </Button>
        </CardFooter>
      </Card>
    </OnboardingShell>
  );
}
