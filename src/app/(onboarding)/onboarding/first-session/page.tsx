"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OnboardingShell } from "@/components/onboarding-shell";

export default function FirstSessionPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");

  return (
    <OnboardingShell currentStep="first-session">
      <Card>
        <CardHeader className="text-center pb-2">
          <h1 className="text-2xl font-semibold tracking-tight">Create your first session</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sessions are collaborative workspaces where AI helps your team stay aligned.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="session-name" className="text-sm font-medium">
              Session name
            </label>
            <Input
              id="session-name"
              placeholder="e.g. Q1 Planning, Sprint Review"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="session-goal" className="text-sm font-medium">
              Goal <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              id="session-goal"
              placeholder="What do you want to accomplish?"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
            />
          </div>
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            <p>You&apos;ll be able to add context, invite members, and chat with AI once the session is created.</p>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push("/onboarding/complete")}
          >
            Skip for now
          </Button>
          <Button
            className="flex-1"
            onClick={() => router.push("/onboarding/complete")}
            disabled={!name.trim()}
          >
            Create session
          </Button>
        </CardFooter>
      </Card>
    </OnboardingShell>
  );
}
