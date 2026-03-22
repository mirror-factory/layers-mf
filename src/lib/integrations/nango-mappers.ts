/**
 * Nango sync record mappers.
 *
 * Each provider returns records in a different shape. These mappers normalise
 * them into a common `MappedRecord` that the webhook handler can insert
 * directly into `context_items`.
 */

export interface MappedRecord {
  source_id: string;
  title: string;
  raw_content: string;
  content_type: string;
  source_created_at: string | null;
  source_metadata: Record<string, unknown> | null;
}

const MIN_CONTENT_LENGTH = 30;

// ── Google Drive ────────────────────────────────────────────────────────────

function mapGoogleDrive(record: Record<string, unknown>): MappedRecord | null {
  const name = String(record.name ?? record.title ?? "Untitled");
  const content = String(
    record.content ?? record.exportedContent ?? record.body ?? ""
  ).trim();

  if (content.length < MIN_CONTENT_LENGTH) return null;

  return {
    source_id: String(record.id ?? ""),
    title: name,
    raw_content: content.slice(0, 12_000),
    content_type: "document",
    source_created_at: (record.createdTime as string) ?? null,
    source_metadata: {
      mimeType: record.mimeType ?? null,
      webViewLink: record.webViewLink ?? null,
      modifiedTime: record.modifiedTime ?? null,
      lastModifiedBy:
        (record.lastModifyingUser as Record<string, unknown>)?.displayName ??
        null,
    },
  };
}

// ── Linear ──────────────────────────────────────────────────────────────────

function mapLinear(record: Record<string, unknown>): MappedRecord | null {
  const identifier = record.identifier as string | undefined;
  const title = String(record.title ?? "Untitled");
  const description = String(record.description ?? "").trim();

  const meta: string[] = [];
  if (identifier) meta.push(`ID: ${identifier}`);

  const state = record.state as Record<string, unknown> | undefined;
  if (state?.name) meta.push(`Status: ${state.name}`);

  const assignee = record.assignee as Record<string, unknown> | undefined;
  if (assignee?.name) meta.push(`Assignee: ${assignee.name}`);

  if (record.priority != null) {
    const priorityLabels = ["None", "Urgent", "High", "Medium", "Low"];
    const idx = Number(record.priority);
    meta.push(`Priority: ${priorityLabels[idx] ?? idx}`);
  }

  const labels = record.labels as
    | { nodes?: { name: string }[] }
    | undefined;
  const labelNames = labels?.nodes?.map((l) => l.name) ?? [];
  if (labelNames.length > 0) meta.push(`Labels: ${labelNames.join(", ")}`);

  const metaBlock = meta.length > 0 ? `\n\n${meta.join(" | ")}` : "";
  const content = (description + metaBlock).trim();

  if (content.length < MIN_CONTENT_LENGTH) return null;

  return {
    source_id: String(record.id ?? ""),
    title: identifier ? `${identifier}: ${title}` : title,
    raw_content: content.slice(0, 12_000),
    content_type: "issue",
    source_created_at: (record.createdAt as string) ?? null,
    source_metadata: {
      identifier: identifier ?? null,
      state: state?.name ?? null,
      assignee: assignee?.name ?? null,
      priority: record.priority ?? null,
      labels: labelNames,
    },
  };
}

// ── Slack ────────────────────────────────────────────────────────────────────

function mapSlack(record: Record<string, unknown>): MappedRecord | null {
  const channelName = String(record.channel_name ?? record.channelName ?? record.name ?? "unknown");
  const messages = record.messages as
    | { text?: string; user?: string; ts?: string }[]
    | undefined;

  let content: string;
  if (messages && Array.isArray(messages)) {
    content = messages
      .filter((m) => m.text && m.text.length > 0)
      .map((m) => {
        const author = m.user ? `[${m.user}] ` : "";
        return `${author}${m.text}`;
      })
      .join("\n\n");
  } else {
    // Fallback: record itself might be a single message or pre-batched content
    content = String(record.content ?? record.text ?? record.body ?? "").trim();
  }

  if (content.length < MIN_CONTENT_LENGTH) return null;

  return {
    source_id: String(record.id ?? `slack-${channelName}`),
    title: `#${channelName} — recent messages`,
    raw_content: content.slice(0, 12_000),
    content_type: "message",
    source_created_at: (record.created_at as string) ?? (record.ts as string) ?? null,
    source_metadata: {
      channelName,
      channelId: record.channel_id ?? record.channelId ?? null,
    },
  };
}

// ── Discord ─────────────────────────────────────────────────────────────────

function mapDiscord(record: Record<string, unknown>): MappedRecord | null {
  const channelName = String(record.channel_name ?? record.channelName ?? record.name ?? "unknown");
  const guildName = String(record.guild_name ?? record.guildName ?? "");

  const messages = record.messages as
    | { content?: string; author?: { username?: string; bot?: boolean }; timestamp?: string }[]
    | undefined;

  let content: string;
  if (messages && Array.isArray(messages)) {
    content = messages
      .filter((m) => m.content && !m.author?.bot)
      .map((m) => {
        const author = m.author?.username ? `[${m.author.username}] ` : "";
        return `${author}${m.content}`;
      })
      .join("\n\n");
  } else {
    content = String(record.content ?? record.body ?? "").trim();
  }

  if (content.length < MIN_CONTENT_LENGTH) return null;

  const titleParts = [`#${channelName}`];
  if (guildName) titleParts.push(guildName);

  return {
    source_id: String(record.id ?? `discord-channel-${channelName}`),
    title: titleParts.join(" — "),
    raw_content: content.slice(0, 12_000),
    content_type: "message",
    source_created_at: (record.created_at as string) ?? null,
    source_metadata: {
      channelName,
      channelId: record.channel_id ?? record.channelId ?? null,
      guildName,
      guildId: record.guild_id ?? record.guildId ?? null,
    },
  };
}

// ── GitHub ───────────────────────────────────────────────────────────────────

function mapGitHub(record: Record<string, unknown>): MappedRecord | null {
  const repoName = String(record.repo_name ?? record.repoName ?? record.repository ?? "");
  const issueTitle = String(record.title ?? "Untitled");
  const body = String(record.body ?? record.content ?? record.description ?? "").trim();
  const state = record.state as string | undefined;

  const labelRecords = record.labels as { name?: string }[] | undefined;
  const labelNames = labelRecords?.map((l) => l.name).filter(Boolean) ?? [];

  const meta: string[] = [];
  if (state) meta.push(`State: ${state}`);
  if (labelNames.length > 0) meta.push(`Labels: ${labelNames.join(", ")}`);
  const metaBlock = meta.length > 0 ? `\n\n${meta.join(" | ")}` : "";

  const content = (body + metaBlock).trim();
  if (content.length < MIN_CONTENT_LENGTH) return null;

  const title = repoName ? `[${repoName}] ${issueTitle}` : issueTitle;

  return {
    source_id: String(record.id ?? ""),
    title,
    raw_content: content.slice(0, 12_000),
    content_type: "issue",
    source_created_at: (record.created_at as string) ?? (record.createdAt as string) ?? null,
    source_metadata: {
      repoName: repoName || null,
      state: state ?? null,
      labels: labelNames,
      number: record.number ?? null,
      url: record.html_url ?? record.url ?? null,
    },
  };
}

// ── Granola ──────────────────────────────────────────────────────────────────

function mapGranola(record: Record<string, unknown>): MappedRecord | null {
  const title = String(record.title ?? "Untitled meeting");
  const transcript = String(record.transcript ?? record.content ?? "").trim();

  const attendees = record.attendees as
    | { name?: string; email?: string }[]
    | undefined;
  const attendeeNames = (attendees ?? [])
    .map((a) => a.name ?? a.email ?? "")
    .filter(Boolean);
  const attendeeLine =
    attendeeNames.length > 0
      ? `\n\nAttendees: ${attendeeNames.join(", ")}`
      : "";

  const content = (transcript + attendeeLine).trim();
  if (content.length < MIN_CONTENT_LENGTH) return null;

  return {
    source_id: String(record.id ?? ""),
    title,
    raw_content: content.slice(0, 12_000),
    content_type: "meeting_transcript",
    source_created_at: (record.created_at as string) ?? (record.createdAt as string) ?? null,
    source_metadata: {
      attendees: attendeeNames,
    },
  };
}

// ── Google Calendar ─────────────────────────────────────────────────────────

function mapGoogleCalendar(record: Record<string, unknown>): MappedRecord | null {
  const summary = String(record.summary ?? record.title ?? "Untitled Event");
  const startObj = record.start as Record<string, unknown> | undefined;
  const endObj = record.end as Record<string, unknown> | undefined;
  const start = String(startObj?.dateTime ?? startObj?.date ?? "");
  const end = String(endObj?.dateTime ?? endObj?.date ?? "");
  const attendees = (
    (record.attendees as { email?: string; displayName?: string }[]) ?? []
  )
    .map((a) => a.email ?? a.displayName ?? "")
    .filter(Boolean)
    .join(", ");
  const description = String(record.description ?? "");
  const location = String(record.location ?? "");
  const hangoutLink = String(record.hangoutLink ?? "");

  const content = [
    `Event: ${summary}`,
    `When: ${start} — ${end}`,
    location ? `Where: ${location}` : "",
    attendees ? `Attendees: ${attendees}` : "",
    hangoutLink ? `Meet: ${hangoutLink}` : "",
    description ? `\nDescription:\n${description}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    source_id: String(record.id ?? String(Date.now())),
    title: summary,
    raw_content: content,
    content_type: "calendar_event",
    source_created_at: (record.created as string) ?? null,
    source_metadata: {
      start: startObj ?? null,
      end: endObj ?? null,
      attendees: record.attendees ?? null,
      location: location || null,
      status: record.status ?? null,
    },
  };
}

// ── Notion ─────────────────────────────────────────────────────────────────

function mapNotion(record: Record<string, unknown>): MappedRecord | null {
  // Extract title from various Notion record shapes
  const props = record.properties as Record<string, unknown> | undefined;
  let title = (record.title as string) ?? null;

  if (!title && props) {
    // Try properties.title.title[0].plain_text
    const titleProp = props.title as Record<string, unknown> | undefined;
    if (titleProp?.title) {
      const titleArr = titleProp.title as { plain_text?: string }[];
      if (titleArr?.[0]?.plain_text) {
        title = titleArr[0].plain_text;
      }
    }
    // Try properties.Name.title[0].plain_text
    if (!title) {
      const nameProp = props.Name as Record<string, unknown> | undefined;
      if (nameProp?.title) {
        const titleArr = nameProp.title as { plain_text?: string }[];
        if (titleArr?.[0]?.plain_text) {
          title = titleArr[0].plain_text;
        }
      }
    }
  }

  title = title ?? "Untitled";

  const content = String(record.content ?? record.markdown ?? "").trim();
  const url = (record.url as string) ?? null;
  const lastEdited = (record.last_edited_time as string) ?? null;

  if (content.length < MIN_CONTENT_LENGTH) return null;

  return {
    source_id: String(record.id ?? String(Date.now())),
    title,
    raw_content: content.slice(0, 12_000),
    content_type: "document",
    source_created_at: (record.created_time as string) ?? lastEdited ?? null,
    source_metadata: {
      url,
      last_edited_time: lastEdited,
      type: record.object ?? null,
    },
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Map a raw Nango sync record to our normalised context_items shape.
 * Returns `null` if the record has no meaningful content (< 30 chars).
 */
export function mapNangoRecord(
  provider: string,
  record: Record<string, unknown>
): MappedRecord | null {
  switch (provider) {
    case "google-drive":
      return mapGoogleDrive(record);
    case "linear":
      return mapLinear(record);
    case "slack":
      return mapSlack(record);
    case "discord":
      return mapDiscord(record);
    case "github":
      return mapGitHub(record);
    case "granola":
      return mapGranola(record);
    case "google-calendar":
      return mapGoogleCalendar(record);
    case "notion":
      return mapNotion(record);
    default:
      // Generic fallback — try common field names
      return mapGeneric(provider, record);
  }
}

function mapGeneric(
  provider: string,
  record: Record<string, unknown>
): MappedRecord | null {
  const title = String(record.title ?? record.name ?? "Untitled");
  const content = String(
    record.content ?? record.body ?? record.description ?? record.text ?? ""
  ).trim();

  if (content.length < MIN_CONTENT_LENGTH) return null;

  return {
    source_id: String(record.id ?? ""),
    title,
    raw_content: content.slice(0, 12_000),
    content_type: "document",
    source_created_at: (record.created_at as string) ?? null,
    source_metadata: null,
  };
}
