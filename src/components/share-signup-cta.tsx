"use client";

import { useState, useEffect } from "react";
import { X, MessageSquare, Search, Zap, Users } from "lucide-react";
import Link from "next/link";

export function ShareSignupCTA() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 15000);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-md rounded-xl border bg-card p-6 shadow-2xl">
        <button
          onClick={() => setShow(false)}
          className="absolute right-3 top-3 p-1 rounded-md text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
            </span>
          </div>

          <h2 className="text-xl font-bold text-foreground">
            Want your own AI Chief of Staff?
          </h2>
          <p className="text-sm text-muted-foreground">
            Granger connects all your tools into one AI-powered workspace.
          </p>

          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
              <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium">AI Chat</p>
                <p className="text-[10px] text-muted-foreground">9 models, tool calling, artifacts</p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
              <Search className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium">Knowledge Search</p>
                <p className="text-[10px] text-muted-foreground">Search across all your docs</p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
              <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium">Scheduling</p>
                <p className="text-[10px] text-muted-foreground">Background AI tasks on autopilot</p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
              <Users className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium">Team Sharing</p>
                <p className="text-[10px] text-muted-foreground">Share anything with your team</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get Started Free
            </Link>
            <button
              onClick={() => setShow(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
