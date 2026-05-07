"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";

interface LiveActivityPlugin {
  start(options: { conversationId: string; modelName: string }): Promise<{ activityId: string }>;
  update(options: { status: string; toolName?: string; progress: number; tokenCount?: number }): Promise<void>;
  end(options: { tokenCount?: number }): Promise<void>;
}

const LiveActivity = registerPlugin<LiveActivityPlugin>("LiveActivity");

/**
 * Start a Dynamic Island Live Activity when AI generation begins.
 */
export async function startLiveActivity(conversationId: string, modelName: string) {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const result = await LiveActivity.start({ conversationId, modelName });
    return result.activityId;
  } catch (err) {
    console.log("[LiveActivity] Not available:", err);
    return null;
  }
}

/**
 * Update the Live Activity with current tool/progress.
 */
export async function updateLiveActivity(
  status: "generating" | "searching" | "thinking",
  toolName?: string,
  progress = 0.5
) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LiveActivity.update({ status, toolName, progress });
  } catch {
    // Silently fail on web
  }
}

/**
 * End the Live Activity when generation completes.
 */
export async function endLiveActivity(tokenCount?: number) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LiveActivity.end({ tokenCount });
  } catch {
    // Silently fail on web
  }
}
