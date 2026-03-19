"use client";

import { useEffect } from "react";
import { trackDwell } from "@/lib/tracking";

interface DwellTrackerProps {
  resourceType: string;
  resourceId: string;
  sourceType?: string;
  contentType?: string;
}

/**
 * Client component wrapper that tracks dwell time on a page.
 * Renders nothing — purely a side-effect component.
 */
export function DwellTracker({
  resourceType,
  resourceId,
  sourceType,
  contentType,
}: DwellTrackerProps) {
  useEffect(() => {
    const cleanup = trackDwell({
      resourceType,
      resourceId,
      sourceType,
      contentType,
    });
    return cleanup;
  }, [resourceType, resourceId, sourceType, contentType]);

  return null;
}
