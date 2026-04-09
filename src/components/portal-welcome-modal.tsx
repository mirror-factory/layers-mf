"use client";

import { useState, useEffect } from "react";
import {
  MessageSquare,
  Navigation,
  BarChart3,
  BookOpen,
  Library,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PortalWelcomeModalProps {
  brandColor: string;
  clientName?: string;
  logoUrl?: string;
  isDark?: boolean;
  onDismiss?: () => void;
}

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Chat with AI",
    description: "Ask questions about any section",
  },
  {
    icon: Navigation,
    title: "Navigate Document",
    description: "Jump to any page or section instantly",
  },
  {
    icon: BarChart3,
    title: "Interactive Charts",
    description: "Visualize data on demand",
  },
  {
    icon: BookOpen,
    title: "Document Walkthrough",
    description: "Guided tour through the proposal",
  },
  {
    icon: Library,
    title: "Full Document Library",
    description: "Access all supporting materials",
  },
];

export function PortalWelcomeModal({
  brandColor,
  clientName,
  logoUrl,
  isDark = false,
  onDismiss,
}: PortalWelcomeModalProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const sessionKey = `portal-welcome-seen-${clientName ?? "portal"}`;

  useEffect(() => {
    if (sessionStorage.getItem(sessionKey)) return;

    const timer = setTimeout(() => {
      setVisible(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [sessionKey]);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(sessionKey, "1");
    onDismiss?.();
    setTimeout(() => setVisible(false), 300);
  };

  if (!visible) return null;

  // Theme tokens
  const backdrop = isDark ? "bg-black/60" : "bg-black/30";
  const card = isDark
    ? "bg-[#0a0a0f]/95 border-white/10 shadow-2xl"
    : "bg-white border-gray-200 shadow-xl";
  const heading = isDark ? "text-white" : "text-gray-900";
  const subtitle = isDark ? "text-white/60" : "text-gray-500";
  const subtitleStrong = isDark ? "text-white/80" : "text-gray-700";
  const divider = isDark ? "border-white/5" : "border-gray-100";
  const featureTitle = isDark ? "text-white" : "text-gray-800";
  const featureDesc = isDark ? "text-white/50" : "text-gray-500";

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300 ${
        dismissed ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 ${backdrop} backdrop-blur-sm`}
        onClick={handleDismiss}
      />

      {/* Modal card */}
      <div
        className={`relative z-10 w-full max-w-lg mx-4 rounded-2xl border ${card} transition-all duration-500 ${
          dismissed
            ? "scale-95 opacity-0"
            : "scale-100 opacity-100 animate-in fade-in zoom-in-95"
        }`}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-4 px-8 pt-8 pb-4">
          <img
            src={logoUrl || "/bluewave-logo.svg"}
            alt={clientName ? `${clientName} logo` : "Logo"}
            className="h-12 w-auto object-contain"
          />

          {/* Thin colored divider */}
          <div
            className="h-0.5 w-16 rounded-full"
            style={{ backgroundColor: brandColor }}
          />

          <h2 className={`text-xl font-semibold text-center ${heading}`}>
            Welcome to your proposal portal
          </h2>

          <p className={`text-center text-sm ${subtitle}`}>
            Prepared by{" "}
            <span className={`font-medium ${subtitleStrong}`}>
              Mirror Factory
            </span>{" "}
            for{" "}
            <span className={`font-medium ${subtitleStrong}`}>
              {clientName ?? "BlueWave Resource Partners"}
            </span>
          </p>
        </div>

        {/* Divider */}
        <div className={`mx-8 border-t ${divider}`} />

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-8 py-6">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `${brandColor}22` }}
              >
                <feature.icon
                  className="h-3.5 w-3.5"
                  style={{ color: brandColor }}
                />
              </div>
              <div>
                <p className={`text-sm font-medium ${featureTitle}`}>
                  {feature.title}
                </p>
                <p className={`text-xs ${featureDesc}`}>
                  {feature.description}
                </p>
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
