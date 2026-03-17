import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Compute SHA-256 hash of content for change detection */
export function computeContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Result of comparing an existing item to an incoming update */
export interface ChangeDetectionResult {
  changed: boolean;
  contentChanged: boolean;
  metadataChanged: boolean;
  changedFields: string[];
  changeType:
    | "content_updated"
    | "metadata_updated"
    | "status_changed"
    | "no_change";
}

/**
 * Determine what changed between an existing context item and an incoming update.
 *
 * 1. Computes content hash of incoming raw_content and compares to stored hash.
 * 2. Deep-compares source_metadata fields (title, status, assignee, labels, etc.).
 * 3. Returns which fields changed and classifies the change type.
 */
export function detectChanges(
  existing: {
    raw_content: string | null;
    content_hash: string | null;
    title: string;
    source_metadata: Record<string, unknown> | null;
  },
  incoming: {
    raw_content: string;
    title: string;
    source_metadata: Record<string, unknown> | null;
  }
): ChangeDetectionResult {
  const changedFields: string[] = [];

  // ── Content comparison ──────────────────────────────────────────────────
  const incomingHash = computeContentHash(incoming.raw_content);
  const existingHash =
    existing.content_hash ??
    (existing.raw_content ? computeContentHash(existing.raw_content) : null);

  const contentChanged = incomingHash !== existingHash;
  if (contentChanged) {
    changedFields.push("raw_content");
  }

  // ── Title comparison ────────────────────────────────────────────────────
  if (existing.title !== incoming.title) {
    changedFields.push("title");
  }

  // ── Source metadata deep comparison ─────────────────────────────────────
  const metadataChangedFields = diffMetadata(
    existing.source_metadata,
    incoming.source_metadata
  );
  changedFields.push(...metadataChangedFields);

  const metadataChanged =
    changedFields.includes("title") || metadataChangedFields.length > 0;

  // ── Classify change type ────────────────────────────────────────────────
  if (!contentChanged && !metadataChanged) {
    return {
      changed: false,
      contentChanged: false,
      metadataChanged: false,
      changedFields: [],
      changeType: "no_change",
    };
  }

  // Check if this is specifically a status change
  const isStatusChange =
    !contentChanged &&
    metadataChangedFields.length === 1 &&
    metadataChangedFields[0] === "source_metadata.status";

  let changeType: ChangeDetectionResult["changeType"];
  if (contentChanged) {
    changeType = "content_updated";
  } else if (isStatusChange) {
    changeType = "status_changed";
  } else {
    changeType = "metadata_updated";
  }

  return {
    changed: true,
    contentChanged,
    metadataChanged,
    changedFields,
    changeType,
  };
}

/**
 * Deep-compare two metadata objects, returning a list of changed field paths
 * prefixed with "source_metadata.".
 */
function diffMetadata(
  existing: Record<string, unknown> | null,
  incoming: Record<string, unknown> | null
): string[] {
  const changed: string[] = [];

  // Both null/undefined → no change
  if (!existing && !incoming) return changed;

  // One null, other not → everything changed
  if (!existing || !incoming) {
    const keys = Object.keys(existing ?? incoming ?? {});
    return keys.map((k) => `source_metadata.${k}`);
  }

  // Compare each key from the union of both objects
  const allKeys = new Set([...Object.keys(existing), ...Object.keys(incoming)]);
  for (const key of allKeys) {
    if (!deepEqual(existing[key], incoming[key])) {
      changed.push(`source_metadata.${key}`);
    }
  }

  return changed;
}

/** Simple deep equality check for JSON-serialisable values */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
  }

  return false;
}

/**
 * Insert a version snapshot of the current state before an update.
 *
 * The version captures what the item looked like BEFORE the incoming change
 * is applied. This creates an audit trail of all previous states.
 *
 * NOTE: Requires a `context_item_versions` table in the database. If the
 * table does not exist yet, the insert will fail silently with a warning log.
 */
export async function createVersion(
  db: SupabaseClient,
  contextItemId: string,
  orgId: string,
  currentState: {
    title: string;
    raw_content: string | null;
    content_hash: string | null;
    source_metadata: unknown;
  },
  changeType: string,
  changedFields: string[],
  changedBy: string
): Promise<void> {
  try {
    const { error } = await db.from("context_item_versions").insert({
      context_item_id: contextItemId,
      org_id: orgId,
      title: currentState.title,
      raw_content: currentState.raw_content,
      content_hash: currentState.content_hash,
      source_metadata: currentState.source_metadata,
      change_type: changeType,
      changed_fields: changedFields,
      changed_by: changedBy,
      created_at: new Date().toISOString(),
    });

    if (error) {
      // Log but don't throw — versioning is best-effort and should not block sync
      console.warn(
        `[versioning] Failed to create version for ${contextItemId}:`,
        error.message
      );
    }
  } catch (err) {
    console.warn(
      `[versioning] Error creating version for ${contextItemId}:`,
      err instanceof Error ? err.message : err
    );
  }
}
