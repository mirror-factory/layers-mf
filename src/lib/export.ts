/**
 * Export utilities for context items and sessions.
 */

type ExportableItem = {
  title: string;
  description_short?: string | null;
  description_long?: string | null;
  raw_content?: string | null;
  source_type: string;
  content_type: string;
  entities?: Record<string, unknown> | null;
  ingested_at: string;
};

type ExportableSession = {
  name: string;
  goal?: string | null;
  status: string;
};

/** Format a date string as a human-readable date. */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Format an entity array as a comma-separated string. */
function formatEntityList(entities: Record<string, unknown>, key: string): string | null {
  const val = entities[key];
  if (!Array.isArray(val) || val.length === 0) return null;
  return val.map(String).join(", ");
}

/** Export a single context item as Markdown. */
export function contextItemToMarkdown(item: ExportableItem): string {
  const lines: string[] = [];

  lines.push(`# ${item.title}`);
  lines.push("");
  lines.push(
    `**Source:** ${item.source_type} | **Type:** ${item.content_type.replace(/_/g, " ")} | **Date:** ${formatDate(item.ingested_at)}`,
  );

  if (item.description_long) {
    lines.push("");
    lines.push("## Summary");
    lines.push(item.description_long);
  }

  if (item.raw_content) {
    lines.push("");
    lines.push("## Content");
    lines.push(item.raw_content);
  }

  if (item.entities && typeof item.entities === "object") {
    const entityEntries: string[] = [];
    const people = formatEntityList(item.entities, "people");
    const topics = formatEntityList(item.entities, "topics");
    const decisions = formatEntityList(item.entities, "decisions");
    const actionItems = formatEntityList(item.entities, "action_items");
    const projects = formatEntityList(item.entities, "projects");

    if (people) entityEntries.push(`- **People:** ${people}`);
    if (topics) entityEntries.push(`- **Topics:** ${topics}`);
    if (decisions) entityEntries.push(`- **Decisions:** ${decisions}`);
    if (actionItems) entityEntries.push(`- **Action Items:** ${actionItems}`);
    if (projects) entityEntries.push(`- **Projects:** ${projects}`);

    if (entityEntries.length > 0) {
      lines.push("");
      lines.push("## Entities");
      lines.push(...entityEntries);
    }
  }

  lines.push("");
  lines.push("---");

  return lines.join("\n");
}

/** Export multiple items as a combined Markdown document. */
export function itemsToMarkdown(
  items: ExportableItem[],
  title?: string,
): string {
  const lines: string[] = [];

  if (title) {
    lines.push(`# ${title}`);
    lines.push("");
    lines.push(`> ${items.length} item${items.length !== 1 ? "s" : ""} exported on ${formatDate(new Date().toISOString())}`);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  lines.push(items.map((item) => contextItemToMarkdown(item)).join("\n\n"));

  return lines.join("\n");
}

/** Export a session as Markdown (session info + linked items). */
export function sessionToMarkdown(
  session: ExportableSession,
  items: ExportableItem[],
): string {
  const lines: string[] = [];

  lines.push(`# Session: ${session.name}`);
  lines.push("");
  if (session.goal) {
    lines.push(`**Goal:** ${session.goal}`);
    lines.push("");
  }
  lines.push(`**Status:** ${session.status}`);
  lines.push("");
  lines.push(`> ${items.length} context item${items.length !== 1 ? "s" : ""}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  if (items.length > 0) {
    lines.push(items.map((item) => contextItemToMarkdown(item)).join("\n\n"));
  }

  return lines.join("\n");
}
