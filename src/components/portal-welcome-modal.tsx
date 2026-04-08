"use client";

import { useState, useEffect } from "react";
import {
  MessageSquare,
  BarChart3,
  BookOpen,
  FileSearch,
  GitCompareArrows,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PortalWelcomeModalProps {
  clientName: string;
  brandColor: string;
  logoUrl: string | null;
}

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Chat with AI",
    description: "Ask questions about any section of the document",
  },
  {
    icon: BarChart3,
    title: "Interactive Charts",
    description: "Visualize data and budgets on demand",
  },
  {
    icon: BookOpen,
    title: "Document Walkthrough",
    description: "Get a guided tour of key sections",
  },
  {
    icon: FileSearch,
    title: "PDF Navigation",
    description: "Search, highlight, and annotate directly",
  },
  {
    icon: GitCompareArrows,
    title: "Compare Documents",
    description: "Switch between Proposal and Scope of Work",
  },
];

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PortalWelcomeModal({
  clientName,
  brandColor,
  logoUrl,
}: PortalWelcomeModalProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only show once per session
    const key = `portal-welcome-seen-${clientName}`;
    if (sessionStorage.getItem(key)) return;

    const timer = setTimeout(() => {
      setVisible(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [clientName]);

  const handleDismiss = () => {
    setDismissed(true);
    const key = `portal-welcome-seen-${clientName}`;
    sessionStorage.setItem(key, "1");
    // Wait for fade-out animation to finish
    setTimeout(() => setVisible(false), 300);
  };

  if (!visible) return null;

  const initials = getInitials(clientName);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300 ${
        dismissed ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Modal card */}
      <div
        className={`relative z-10 w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-[#0a0a0f]/95 shadow-2xl transition-all duration-500 ${
          dismissed
            ? "scale-95 opacity-0"
            : "scale-100 opacity-100 animate-in fade-in zoom-in-95"
        }`}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-4 px-8 pt-8 pb-4">
          {/* Client logo / initials */}
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${clientName} logo`}
              className="h-16 w-16 rounded-xl object-contain"
            />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-xl text-xl font-bold text-white"
              style={{ backgroundColor: brandColor }}
            >
              {initials}
            </div>
          )}

          <h2 className="text-2xl font-semibold text-white">
            Welcome, {clientName}
          </h2>

          <p className="text-center text-sm text-white/60">
            <span className="font-medium text-white/80">Mirror Factory</span>{" "}
            is excited to present this proposal for your review.
          </p>
        </div>

        {/* Divider */}
        <div className="mx-8 border-t border-white/5" />

        {/* Features */}
        <div className="space-y-3 px-8 py-6">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${brandColor}20` }}
              >
                <feature.icon
                  className="h-4 w-4"
                  style={{ color: brandColor }}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {feature.title}
                </p>
                <p className="text-xs text-white/50">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-8 pb-8">
          <Button
            onClick={handleDismiss}
            className="w-full rounded-xl py-5 text-sm font-semibold text-white transition-all hover:brightness-110"
            style={{ backgroundColor: brandColor }}
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
}
