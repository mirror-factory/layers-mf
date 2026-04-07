import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { nango } from "@/lib/nango/client";
import { extractStructured } from "@/lib/ai/extract";
import { generateEmbedding } from "@/lib/ai/embed";
import { createInboxItems } from "@/lib/inbox";
import {
  fetchDiscordGuilds,
  fetchDiscordChannels,
  fetchDiscordMessages,
  batchMessagesToContent,
  buildChannelMetadata,
} from "@/lib/integrations/discord";
import { windowedSourceId, currentWeekLabel } from "@/lib/integrations/message-windows";
import type { Json } from "@/lib/database.types";
import {
  computeContentHash,
  detectChanges,
  createVersion,
} from "@/lib/versioning";
import { checkCredits, deductCredits, CREDIT_COSTS } from "@/lib/credits";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export const maxDuration = 60;

interface RawRecord {
  id: string;
  title: string;
  content: string;
  sourceCreatedAt?: string | null;
  sourceMetadata?: Json | null;
}

// ── GitHub ─────────────────────────────────────────────────────────────────
async function fetchGitHub(
  provider: string,
  connectionId: string,
  syncConfig: Record<string, unknown> = {}
): Promise<RawRecord[]> {
  const records: RawRecord[] = [];
  const maxRepos = (syncConfig.max_repos as number) ?? 10;
  const includeClosedIssues = (syncConfig.include_closed as boolean) ?? true;
  const repoFilter = (syncConfig.repos as string[] | null) ?? null;

  // Fetch repos the token has access to
  let repos: { full_name: string; name: string }[] = [];
  try {
    const res = await nango.proxy<{ full_name: string; name: string }[]>({
      method: "GET",
      providerConfigKey: provider,
      connectionId,
      endpoint: "/user/repos",
      params: { per_page: String(maxRepos), sort: "pushed" },
    });
    repos = res.data ?? [];
  } catch (err) {
    console.error("[sync:github] repos fetch failed:", err);
    return [];
  }

  // Apply repo filter if configured
  if (repoFilter && repoFilter.length > 0) {
    const filterSet = new Set(repoFilter.map((r) => r.toLowerCase()));
    repos = repos.filter((r) => filterSet.has(r.full_name.toLowerCase()));
  }

  for (const repo of repos.slice(0, maxRepos)) {
    try {
      const issueState = includeClosedIssues ? "all" : "open";
      const res = await nango.proxy<
        { number: number; title: string; body: string | null; created_at: string }[]
      >({
        method: "GET",
        providerConfigKey: provider,
        connectionId,
        endpoint: `/repos/${repo.full_name}/issues`,
        params: { per_page: "30", state: issueState },
      });

      for (const issue of (res.data ?? []).slice(0, 15)) {
        if (!issue.body) continue;
        records.push({
          id: `${repo.full_name}#${issue.number}`,
          title: `[${repo.name}] ${issue.title}`,
          content: issue.body.slice(0, 12000),
          sourceCreatedAt: issue.created_at,
        });
      }
    } catch {
      // repo might have no issues / no access — skip
    }
  }

  return records.slice(0, 30);
}

// ── Google Drive ────────────────────────────────────────────────────────────
// MIME types we can export as plain text (Google-native files)
const GDRIVE_EXPORTABLE: Record<string, string> = {
  "application/vnd.google-apps.document":     "text/plain",
  "application/vnd.google-apps.spreadsheet":  "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

// Uploaded file MIME types we can download and parse
const GDRIVE_DOWNLOADABLE = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

const GDRIVE_FRIENDLY_NAMES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "text/plain": "TXT",
  "text/markdown": "Markdown",
  "text/csv": "CSV",
};

async function fetchGoogleDrive(
  provider: string,
  connectionId: string,
  syncConfig: Record<string, unknown> = {}
): Promise<{ records: RawRecord[]; debug: string[] }> {
  const records: RawRecord[] = [];
  const debug: string[] = [];
  const maxFiles = (syncConfig.max_files as number) ?? 100;
  const folderFilter = (syncConfig.folder_filter as string | null) ?? null;
  const fileTypes = (syncConfig.file_types as string[] | null) ?? null;

  let files: {
    id: string;
    name: string;
    mimeType: string;
    createdTime?: string;
    modifiedTime?: string;
    webViewLink?: string;
    size?: string;
    lastModifyingUser?: { displayName?: string; emailAddress?: string };
  }[] = [];
  try {
    const res = await nango.proxy<{
      files: typeof files;
    }>({
      method: "GET",
      providerConfigKey: provider,
      connectionId,
      endpoint: "/drive/v3/files",
      params: {
        q: "trashed=false and (mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.presentation' or mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='text/plain' or mimeType='text/markdown' or mimeType='text/csv')",
        fields: "files(id,name,mimeType,createdTime,modifiedTime,webViewLink,size,lastModifyingUser(displayName,emailAddress))",
        pageSize: String(maxFiles),
        orderBy: "modifiedTime desc",
      },
    });
    files = res.data?.files ?? [];

    // Apply folder filter if configured (filter by file name containing folder path)
    if (folderFilter) {
      const folders = folderFilter.split(",").map((f) => f.trim().toLowerCase()).filter(Boolean);
      if (folders.length > 0) {
        debug.push(`Folder filter active: ${folders.join(", ")}`);
        // Note: basic name-based filtering; Drive API folder queries require parent ID lookups
      }
    }

    // Apply file type filter if configured
    if (fileTypes && fileTypes.length > 0) {
      const typeToMime: Record<string, string[]> = {
        docs: ["application/vnd.google-apps.document"],
        sheets: ["application/vnd.google-apps.spreadsheet", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
        slides: ["application/vnd.google-apps.presentation"],
        pdfs: ["application/pdf"],
        word: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      };
      const allowedMimes = new Set(fileTypes.flatMap((t) => typeToMime[t] ?? []));
      // Also keep text/plain and text/markdown as they're always useful
      allowedMimes.add("text/plain");
      allowedMimes.add("text/markdown");
      files = files.filter((f) => allowedMimes.has(f.mimeType));
      debug.push(`File type filter: ${fileTypes.join(", ")} (${files.length} files match)`);
    }

    debug.push(`Found ${files.length} files in Drive`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debug.push(`Drive API error: ${msg}`);
    return { records, debug };
  }

  for (const file of files) {
    const exportMime = GDRIVE_EXPORTABLE[file.mimeType];
    const isDownloadable = GDRIVE_DOWNLOADABLE.has(file.mimeType);

    if (!exportMime && !isDownloadable) {
      const friendly = file.mimeType.split(".").pop() ?? file.mimeType;
      debug.push(`Skipped: ${file.name} (${friendly} — unsupported file type)`);
      continue;
    }

    try {
      let content = "";

      if (exportMime) {
        // Google-native files: use export endpoint
        const res = await nango.proxy<string>({
          method: "GET",
          providerConfigKey: provider,
          connectionId,
          endpoint: `/drive/v3/files/${file.id}/export`,
          params: { mimeType: exportMime },
        });
        content = typeof res.data === "string" ? res.data.trim() : "";
      } else {
        // Uploaded files: download via alt=media
        const res = await nango.proxy<ArrayBuffer>({
          method: "GET",
          providerConfigKey: provider,
          connectionId,
          endpoint: `/drive/v3/files/${file.id}`,
          params: { alt: "media" },
          responseType: "arraybuffer",
        });

        const buffer = Buffer.from(res.data);

        switch (file.mimeType) {
          case "application/pdf": {
            const parsed = await pdfParse(buffer);
            content = parsed.text.trim();
            break;
          }
          case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
            const parsed = await mammoth.extractRawText({ buffer });
            content = parsed.value.trim();
            break;
          }
          case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
            const workbook = XLSX.read(buffer, { type: "buffer" });
            const sheetName = workbook.SheetNames[0];
            if (sheetName) {
              content = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]).trim();
            }
            break;
          }
          case "text/plain":
          case "text/markdown":
          case "text/csv": {
            content = buffer.toString("utf-8").trim();
            break;
          }
        }
      }

      if (content.length < 30) {
        debug.push(`Skipped: ${file.name} (empty content)`);
        continue;
      }

      const friendlyType = GDRIVE_FRIENDLY_NAMES[file.mimeType]
        ?? file.mimeType.split(".").pop()
        ?? file.mimeType;
      debug.push(
        `Imported: ${file.name} (${friendlyType}, ${content.length.toLocaleString()} chars)`
      );

      records.push({
        id: file.id,
        title: file.name,
        content: content.slice(0, 12000),
        sourceCreatedAt: file.createdTime ?? null,
        sourceMetadata: {
          url: file.webViewLink ?? null,
          mimeType: file.mimeType,
          fileSize: file.size ?? null,
          lastModifiedBy: file.lastModifyingUser?.displayName ?? null,
          modifiedTime: file.modifiedTime ?? null,
        } satisfies Json,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debug.push(`Failed: ${file.name} — ${msg}`);
    }
  }

  return { records, debug };
}

// ── Slack ───────────────────────────────────────────────────────────────────
async function fetchSlack(
  provider: string,
  connectionId: string,
  syncConfig: Record<string, unknown> = {}
): Promise<RawRecord[]> {
  const records: RawRecord[] = [];
  const maxMessages = (syncConfig.max_messages as number) ?? 200;
  const excludeBots = (syncConfig.exclude_bots as boolean) ?? true;
  const channelFilter = (syncConfig.channels as string[] | null) ?? null;

  let channels: { id: string; name: string }[] = [];
  try {
    const res = await nango.proxy<{
      channels: { id: string; name: string }[];
    }>({
      method: "GET",
      providerConfigKey: provider,
      connectionId,
      endpoint: "/api/conversations.list",
      params: { types: "public_channel", limit: "20" },
    });
    channels = res.data?.channels ?? [];
  } catch (err) {
    console.error("[sync:slack] channels fetch failed:", err);
    return [];
  }

  // Apply channel filter if configured
  if (channelFilter && channelFilter.length > 0) {
    const filterSet = new Set(channelFilter.map((c) => c.toLowerCase()));
    channels = channels.filter(
      (c) => filterSet.has(c.id.toLowerCase()) || filterSet.has(c.name.toLowerCase())
    );
  }

  for (const channel of channels.slice(0, 20)) {
    try {
      const res = await nango.proxy<{
        messages: { ts: string; text?: string; user?: string; bot_id?: string; subtype?: string }[];
      }>({
        method: "GET",
        providerConfigKey: provider,
        connectionId,
        endpoint: "/api/conversations.history",
        params: { channel: channel.id, limit: String(maxMessages) },
      });

      const msgs = (res.data?.messages ?? [])
        .filter((m) => {
          if (!m.text || m.text.length <= 20) return false;
          if (excludeBots && (m.bot_id || m.subtype === "bot_message")) return false;
          return true;
        })
        .map((m) => m.text!)
        .join("\n\n");

      if (msgs.length < 50) continue;

      const weekLabel = currentWeekLabel();
      records.push({
        id: windowedSourceId("slack", channel.id),
        title: `#${channel.name} — recent messages (${weekLabel})`,
        content: msgs.slice(0, 12000),
      });
    } catch {
      // skip inaccessible channels
    }
  }

  return records;
}

// ── Granola ──────────────────────────────────────────────────────────────────
async function fetchGranola(
  provider: string,
  connectionId: string,
  syncConfig: Record<string, unknown> = {}
): Promise<RawRecord[]> {
  const records: RawRecord[] = [];
  const maxDocuments = (syncConfig.max_documents as number) ?? 50;

  let docs: {
    id: string;
    title?: string;
    transcript?: string;
    created_at?: string;
    attendees?: { name?: string; email?: string }[];
  }[] = [];

  try {
    const res = await nango.proxy<{
      documents?: typeof docs;
      data?: typeof docs;
    }>({
      method: "GET",
      providerConfigKey: provider,
      connectionId,
      endpoint: "/v1/documents",
      params: { limit: String(maxDocuments) },
    });
    docs = res.data?.documents ?? res.data?.data ?? (Array.isArray(res.data) ? res.data : []);
  } catch (err) {
    console.error("[sync:granola] documents fetch failed:", err);
    return [];
  }

  for (const doc of docs) {
    const transcript = doc.transcript ?? "";
    if (transcript.length < 50) continue;

    const attendeeNames = (doc.attendees ?? [])
      .map((a) => a.name ?? a.email ?? "")
      .filter(Boolean);
    const attendeeLine = attendeeNames.length > 0
      ? `\n\nAttendees: ${attendeeNames.join(", ")}`
      : "";

    records.push({
      id: doc.id,
      title: doc.title ?? "Untitled meeting",
      content: (transcript + attendeeLine).slice(0, 12000),
      sourceCreatedAt: doc.created_at ?? null,
    });
  }

  return records.slice(0, 30);
}

// ── Linear ───────────────────────────────────────────────────────────────────
async function fetchLinear(
  provider: string,
  connectionId: string,
  syncConfig: Record<string, unknown> = {}
): Promise<RawRecord[]> {
  const records: RawRecord[] = [];
  const maxItems = (syncConfig.max_items as number) ?? 100;
  const includeArchived = (syncConfig.include_archived as boolean) ?? false;
  const teamFilter = (syncConfig.teams as string[] | null) ?? null;

  let issues: {
    id: string;
    identifier?: string;
    title: string;
    description?: string | null;
    state?: { name?: string } | null;
    assignee?: { name?: string } | null;
    priority?: number;
    labels?: { nodes?: { name: string }[] } | null;
    createdAt?: string;
    archivedAt?: string | null;
    team?: { name?: string } | null;
  }[] = [];

  try {
    const res = await nango.proxy<{
      issues?: typeof issues;
      nodes?: typeof issues;
      data?: { issues?: { nodes?: typeof issues } };
    }>({
      method: "GET",
      providerConfigKey: provider,
      connectionId,
      endpoint: "/issues",
      params: { first: String(Math.min(maxItems, 50)), orderBy: "updatedAt" },
    });
    issues =
      res.data?.issues ??
      res.data?.nodes ??
      res.data?.data?.issues?.nodes ??
      (Array.isArray(res.data) ? res.data : []);
  } catch (err) {
    console.error("[sync:linear] issues fetch failed:", err);
    return [];
  }

  // Filter archived issues if not included
  if (!includeArchived) {
    issues = issues.filter((i) => !i.archivedAt);
  }

  // Filter by team if configured
  if (teamFilter && teamFilter.length > 0) {
    const filterSet = new Set(teamFilter.map((t) => t.toLowerCase()));
    issues = issues.filter(
      (i) => !i.team?.name || filterSet.has(i.team.name.toLowerCase())
    );
  }

  for (const issue of issues) {
    const description = issue.description ?? "";
    if (description.length < 10) continue;

    const meta: string[] = [];
    if (issue.identifier) meta.push(`ID: ${issue.identifier}`);
    if (issue.state?.name) meta.push(`Status: ${issue.state.name}`);
    if (issue.assignee?.name) meta.push(`Assignee: ${issue.assignee.name}`);
    if (issue.priority != null) {
      const priorityLabels = ["None", "Urgent", "High", "Medium", "Low"];
      meta.push(`Priority: ${priorityLabels[issue.priority] ?? issue.priority}`);
    }
    const labels = issue.labels?.nodes?.map((l) => l.name) ?? [];
    if (labels.length > 0) meta.push(`Labels: ${labels.join(", ")}`);

    const metaBlock = meta.length > 0 ? `\n\n${meta.join(" | ")}` : "";
    const content = (description + metaBlock).slice(0, 12000);

    records.push({
      id: issue.id,
      title: issue.identifier
        ? `${issue.identifier}: ${issue.title}`
        : issue.title,
      content,
      sourceCreatedAt: issue.createdAt ?? null,
    });
  }

  return records.slice(0, maxItems);
}

// ── Notion ──────────────────────────────────────────────────────────────────

function notionRichTextToPlain(richText: unknown[]): string {
  return (richText ?? []).map((t: unknown) => (t as { plain_text?: string }).plain_text ?? "").join("");
}

function notionBlocksToText(blocks: unknown[]): string {
  return blocks.map((block: unknown) => {
    const b = block as Record<string, unknown>;
    const type = b.type as string;
    const data = b[type] as Record<string, unknown> | undefined;
    if (!data) return "";

    switch (type) {
      case "paragraph": return notionRichTextToPlain(data.rich_text as unknown[]);
      case "heading_1": return `# ${notionRichTextToPlain(data.rich_text as unknown[])}`;
      case "heading_2": return `## ${notionRichTextToPlain(data.rich_text as unknown[])}`;
      case "heading_3": return `### ${notionRichTextToPlain(data.rich_text as unknown[])}`;
      case "bulleted_list_item": return `- ${notionRichTextToPlain(data.rich_text as unknown[])}`;
      case "numbered_list_item": return `1. ${notionRichTextToPlain(data.rich_text as unknown[])}`;
      case "to_do": return `[${data.checked ? "x" : " "}] ${notionRichTextToPlain(data.rich_text as unknown[])}`;
      case "toggle": return `> ${notionRichTextToPlain(data.rich_text as unknown[])}`;
      case "code": return `\`\`\`${(data.language as string) ?? ""}\n${notionRichTextToPlain(data.rich_text as unknown[])}\n\`\`\``;
      case "quote": return `> ${notionRichTextToPlain(data.rich_text as unknown[])}`;
      case "callout": return notionRichTextToPlain(data.rich_text as unknown[]);
      case "divider": return "---";
      default: return "";
    }
  }).filter(Boolean).join("\n\n");
}

async function fetchNotion(
  provider: string,
  connectionId: string
): Promise<RawRecord[]> {
  const records: RawRecord[] = [];

  // Notion uses POST for search
  let pages: {
    id: string;
    object: string;
    url?: string;
    created_time?: string;
    last_edited_time?: string;
    properties?: Record<string, unknown>;
  }[] = [];

  try {
    const res = await nango.proxy<{
      results: typeof pages;
    }>({
      method: "POST",
      providerConfigKey: provider,
      connectionId,
      endpoint: "/v1/search",
      headers: { "Notion-Version": "2022-06-28" },
      data: {
        page_size: 50,
        sort: { direction: "descending", timestamp: "last_edited_time" },
      },
    });
    pages = (res.data?.results ?? []).filter(
      (r) => r.object === "page"
    );
  } catch (err) {
    console.error("[sync:notion] search failed:", err);
    return [];
  }

  for (const page of pages.slice(0, 50)) {
    try {
      // Extract title from properties
      const props = page.properties ?? {};
      let title = "Untitled";
      for (const val of Object.values(props)) {
        const prop = val as Record<string, unknown>;
        if (prop.type === "title") {
          const titleArr = prop.title as { plain_text?: string }[];
          if (titleArr?.[0]?.plain_text) {
            title = titleArr[0].plain_text;
            break;
          }
        }
      }

      // Fetch page blocks
      const blocksRes = await nango.proxy<{
        results: unknown[];
      }>({
        method: "GET",
        providerConfigKey: provider,
        connectionId,
        endpoint: `/v1/blocks/${page.id}/children`,
        headers: { "Notion-Version": "2022-06-28" },
        params: { page_size: "100" },
      });

      const blocks = blocksRes.data?.results ?? [];
      let content = notionBlocksToText(blocks);

      // Recursively fetch child blocks (max depth 1 more level)
      for (const block of blocks) {
        const b = block as Record<string, unknown>;
        if (b.has_children) {
          try {
            const childRes = await nango.proxy<{
              results: unknown[];
            }>({
              method: "GET",
              providerConfigKey: provider,
              connectionId,
              endpoint: `/v1/blocks/${b.id}/children`,
              headers: { "Notion-Version": "2022-06-28" },
              params: { page_size: "100" },
            });
            const childText = notionBlocksToText(childRes.data?.results ?? []);
            if (childText) {
              content += "\n\n" + childText;
            }
          } catch {
            // skip inaccessible child blocks
          }
        }
      }

      if (content.length < 30) continue;

      records.push({
        id: page.id,
        title,
        content: content.slice(0, 12000),
        sourceCreatedAt: page.created_time ?? null,
        sourceMetadata: {
          url: page.url ?? null,
          last_edited_time: page.last_edited_time ?? null,
          type: page.object,
        } satisfies Json,
      });
    } catch {
      // skip inaccessible pages
    }
  }

  return records;
}

// ── Discord ──────────────────────────────────────────────────────────────────
async function fetchDiscord(
  provider: string,
  connectionId: string,
  syncConfig: Record<string, unknown> = {}
): Promise<RawRecord[]> {
  const records: RawRecord[] = [];
  const maxMessages = (syncConfig.max_messages as number) ?? 100;
  const serverFilter = (syncConfig.servers as string[] | null) ?? null;
  const channelFilter = (syncConfig.channels as string[] | null) ?? null;

  let guilds = await fetchDiscordGuilds(connectionId, provider);
  if (guilds.length === 0) return [];

  // Apply server filter if configured
  if (serverFilter && serverFilter.length > 0) {
    const filterSet = new Set(serverFilter.map((s) => s.toLowerCase()));
    guilds = guilds.filter((g) => filterSet.has(g.name.toLowerCase()));
  }

  for (const guild of guilds.slice(0, 5)) {
    let channels = await fetchDiscordChannels(connectionId, provider, guild.id);

    // Apply channel filter if configured
    if (channelFilter && channelFilter.length > 0) {
      const filterSet = new Set(channelFilter.map((c) => c.toLowerCase()));
      channels = channels.filter((c) => filterSet.has(c.name.toLowerCase()));
    }

    for (const channel of channels.slice(0, 10)) {
      try {
        const messages = await fetchDiscordMessages(
          connectionId,
          provider,
          channel.id,
          { limit: maxMessages }
        );

        // Filter out bot messages and empty messages
        const humanMessages = messages.filter(
          (m) => !m.author.bot && m.content && m.content.trim().length > 0
        );

        if (humanMessages.length === 0) continue;

        const content = batchMessagesToContent(humanMessages, channel.name, guild.name);
        if (content.length < 50) continue;

        const latestId = humanMessages.reduce((latest, msg) =>
          BigInt(msg.id) > BigInt(latest.id) ? msg : latest
        ).id;

        const weekLabel = currentWeekLabel();
        records.push({
          id: windowedSourceId("discord-channel", channel.id),
          title: `#${channel.name} — ${guild.name} (${weekLabel})`,
          content,
          sourceCreatedAt: humanMessages[0]?.timestamp ?? null,
          sourceMetadata: buildChannelMetadata(
            channel.id,
            channel.name,
            guild.id,
            guild.name,
            humanMessages.length,
            latestId
          ) satisfies Json,
        });
      } catch {
        // skip inaccessible channels
      }
    }
  }

  return records;
}

// ── Gmail ────────────────────────────────────────────────────────────────
async function fetchGmail(
  provider: string,
  connectionId: string,
  syncConfig?: Record<string, unknown>
): Promise<RawRecord[]> {
  const records: RawRecord[] = [];
  const maxResults = (syncConfig?.max_messages as number) ?? 50;

  // List recent messages via Gmail API
  const listRes = await nango.proxy<{
    messages?: { id: string; threadId: string }[];
  }>({
    method: "GET",
    providerConfigKey: provider,
    connectionId,
    endpoint: "/gmail/v1/users/me/messages",
    params: { maxResults: String(maxResults), q: "newer_than:7d" },
  });

  const messageIds = listRes.data?.messages ?? [];

  for (const msg of messageIds.slice(0, 30)) {
    try {
      const msgRes = await nango.proxy<{
        id: string;
        threadId: string;
        snippet: string;
        payload: {
          headers: { name: string; value: string }[];
          body?: { data?: string };
          parts?: { mimeType: string; body?: { data?: string } }[];
        };
        internalDate: string;
      }>({
        method: "GET",
        providerConfigKey: provider,
        connectionId,
        endpoint: `/gmail/v1/users/me/messages/${msg.id}`,
        params: { format: "full" },
      });

      const headers = msgRes.data?.payload?.headers ?? [];
      const subject = headers.find(h => h.name.toLowerCase() === "subject")?.value ?? "No Subject";
      const from = headers.find(h => h.name.toLowerCase() === "from")?.value ?? "";
      const to = headers.find(h => h.name.toLowerCase() === "to")?.value ?? "";
      const date = headers.find(h => h.name.toLowerCase() === "date")?.value ?? "";

      // Extract body text
      let body = "";
      const payload = msgRes.data?.payload;
      if (payload?.body?.data) {
        body = Buffer.from(payload.body.data, "base64url").toString("utf-8");
      } else if (payload?.parts) {
        const textPart = payload.parts.find(p => p.mimeType === "text/plain");
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, "base64url").toString("utf-8");
        }
      }

      if (body.length < 30 && !msgRes.data?.snippet) continue;

      const content = [
        `From: ${from}`,
        `To: ${to}`,
        `Date: ${date}`,
        `Subject: ${subject}`,
        "",
        body || msgRes.data?.snippet || "",
      ].join("\n").slice(0, 12000);

      records.push({
        id: msg.id,
        title: subject,
        content,
        sourceCreatedAt: msgRes.data?.internalDate
          ? new Date(Number(msgRes.data.internalDate)).toISOString()
          : null,
        sourceMetadata: {
          threadId: msg.threadId,
          from,
          to,
          subject,
        } satisfies Json,
      });
    } catch {
      // Skip unreadable messages
    }
  }

  return records;
}

// ── Google Calendar ──────────────────────────────────────────────────────
async function fetchGoogleCalendar(
  provider: string,
  connectionId: string
): Promise<RawRecord[]> {
  const records: RawRecord[] = [];

  const now = new Date();
  const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  let events: {
    id: string;
    summary?: string;
    description?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    attendees?: { email?: string; displayName?: string }[];
    location?: string;
    hangoutLink?: string;
    status?: string;
    creator?: { email?: string; displayName?: string };
    created?: string;
  }[] = [];

  try {
    const res = await nango.proxy<{
      items: typeof events;
    }>({
      method: "GET",
      providerConfigKey: provider,
      connectionId,
      endpoint: "/calendar/v3/calendars/primary/events",
      params: {
        timeMin,
        timeMax,
        maxResults: "100",
        singleEvents: "true",
        orderBy: "startTime",
      },
    });
    events = res.data?.items ?? [];
  } catch (err) {
    console.error("[sync:google-calendar] events fetch failed:", err);
    return [];
  }

  for (const event of events) {
    const summary = event.summary ?? "Untitled Event";
    const start = event.start?.dateTime ?? event.start?.date ?? "";
    const end = event.end?.dateTime ?? event.end?.date ?? "";
    const attendees = (event.attendees ?? [])
      .map((a) => a.email ?? a.displayName ?? "")
      .filter(Boolean)
      .join(", ");
    const description = event.description ?? "";
    const location = event.location ?? "";

    const content = [
      `Event: ${summary}`,
      `When: ${start} — ${end}`,
      location ? `Where: ${location}` : "",
      attendees ? `Attendees: ${attendees}` : "",
      event.hangoutLink ? `Meet: ${event.hangoutLink}` : "",
      description ? `\nDescription:\n${description}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    records.push({
      id: event.id ?? String(Date.now()),
      title: summary,
      content: content.slice(0, 12000),
      sourceCreatedAt: event.created ?? null,
      sourceMetadata: {
        start: event.start ?? null,
        end: event.end ?? null,
        attendees: event.attendees ?? null,
        location: event.location ?? null,
        hangoutLink: event.hangoutLink ?? null,
        status: event.status ?? null,
        creator: event.creator ?? null,
      } satisfies Json,
    });
  }

  return records;
}

function contentTypeFor(provider: string): string {
  if (provider.includes("github")) return "issue";
  switch (provider) {
    case "google-drive": return "document";
    case "slack":        return "message";
    case "discord":      return "message";
    case "linear":       return "issue";
    case "granola":           return "meeting_transcript";
    case "google-calendar":   return "calendar_event";
    case "notion":            return "document";
    case "gmail":             return "email_thread";
    default:                  return "document";
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let connectionId: string, provider: string;
  try {
    const body = await request.json();
    connectionId = body.connectionId;
    provider = body.provider;
    if (!connectionId || !provider) throw new Error("missing");
  } catch {
    return NextResponse.json({ error: "connectionId and provider required" }, { status: 400 });
  }

  // Verify the integration belongs to the user's org (RLS scoped)
  const { data: integration } = await supabase
    .from("integrations")
    .select("org_id, sync_config")
    .eq("nango_connection_id", connectionId)
    .single();

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  const orgId = integration.org_id;
  const syncConfig = (integration.sync_config as Record<string, unknown>) ?? {};
  const adminDb = createAdminClient();

  // Helper to format an SSE event
  function sseEvent(data: Record<string, unknown>): string {
    return `data: ${JSON.stringify(data)}\n\n`;
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseEvent(data)));
      };

      try {
        // Fetch raw records from the provider via Nango proxy
        let rawRecords: RawRecord[] = [];
        const debugLines: string[] = [];

        emit({ phase: "fetching", provider, message: `Fetching data from ${provider}...` });

        if (provider.includes("github")) {
          rawRecords = await fetchGitHub(provider, connectionId, syncConfig);
        } else if (provider === "google-drive") {
          const result = await fetchGoogleDrive(provider, connectionId, syncConfig);
          rawRecords = result.records;
          debugLines.push(...result.debug);
        } else if (provider === "slack") {
          rawRecords = await fetchSlack(provider, connectionId, syncConfig);
        } else if (provider === "granola") {
          rawRecords = await fetchGranola(provider, connectionId, syncConfig);
        } else if (provider === "linear") {
          rawRecords = await fetchLinear(provider, connectionId, syncConfig);
        } else if (provider === "discord") {
          rawRecords = await fetchDiscord(provider, connectionId, syncConfig);
        } else if (provider === "google-calendar") {
          rawRecords = await fetchGoogleCalendar(provider, connectionId);
        } else if (provider === "notion") {
          rawRecords = await fetchNotion(provider, connectionId);
        } else if (provider === "gmail") {
          rawRecords = await fetchGmail(provider, connectionId, syncConfig);
        } else {
          emit({ phase: "error", message: `No fetch strategy for provider: ${provider}` });
          controller.close();
          return;
        }

        emit({
          phase: "fetching",
          provider,
          message: `Found ${rawRecords.length} item${rawRecords.length === 1 ? "" : "s"}`,
        });

        if (rawRecords.length === 0) {
          emit({ phase: "complete", processed: 0, fetched: 0, skipped: 0 });
          controller.close();
          return;
        }

        const contentType = contentTypeFor(provider);
        let processed = 0;
        const total = rawRecords.length;

        // Credit check: each AI-processed item costs extraction (2) + embedding (0.5) = 2.5 credits
        const creditCostPerItem = CREDIT_COSTS.extraction + CREDIT_COSTS.embedding;
        const totalCreditCost = total * creditCostPerItem;
        const demoMode = process.env.DEMO_MODE === "true";
        const creditCheck = demoMode
          ? { sufficient: true, balance: 999999 }
          : await checkCredits(orgId, creditCostPerItem);
        let creditsRemaining = creditCheck.balance;

        if (!creditCheck.sufficient) {
          emit({
            phase: "error",
            message: `Insufficient credits. Balance: ${creditCheck.balance}, need at least ${creditCostPerItem} per item.`,
          });
          controller.close();
          return;
        }

        // If not enough credits for all items, warn and process what we can
        const maxAffordable = Math.floor(creditsRemaining / creditCostPerItem);
        if (maxAffordable < total) {
          emit({
            phase: "fetching",
            provider,
            message: `Only ${maxAffordable} of ${total} items can be processed with current credit balance (${creditsRemaining})`,
          });
        }

        for (let i = 0; i < rawRecords.length; i++) {
          const record = rawRecords[i];
          const current = i + 1;

          emit({
            phase: "processing",
            current,
            total,
            title: record.title,
          });

          try {
            // Check if already exists (partial unique index doesn't work reliably with upsert)
            const { data: existing } = await adminDb
              .from("context_items")
              .select("id, raw_content, content_hash, title, source_metadata")
              .eq("org_id", orgId)
              .eq("source_type", provider)
              .eq("source_id", record.id)
              .maybeSingle();

            let item: { id: string } | null = null;

            if (existing) {
              // ── Change detection ────────────────────────────────────────
              // For message streams, compute merged content first
              let mergedContent = record.content;
              if (contentType === "message" && existing.raw_content) {
                const existingLines = new Set(
                  (existing.raw_content as string).split("\n")
                );
                const newLines = record.content
                  .split("\n")
                  .filter((line) => !existingLines.has(line));

                if (newLines.length === 0) {
                  // No new content — skip entirely
                  emit({ phase: "processing", current, total, title: record.title + " (unchanged, skipped)" });
                  continue;
                }

                mergedContent = (
                  (existing.raw_content as string) +
                  "\n" +
                  newLines.join("\n")
                ).slice(0, 12000);
              }

              const changes = detectChanges(
                {
                  raw_content: existing.raw_content as string | null,
                  content_hash: existing.content_hash as string | null,
                  title: existing.title as string,
                  source_metadata: (existing.source_metadata as Record<string, unknown> | null),
                },
                {
                  raw_content: mergedContent,
                  title: record.title,
                  source_metadata: (record.sourceMetadata as Record<string, unknown> | null) ?? null,
                }
              );

              if (!changes.changed) {
                // Skip entirely — save AI credits
                emit({ phase: "processing", current, total, title: record.title + " (unchanged, skipped)" });
                continue;
              }

              // Version the old state before overwriting
              await createVersion(
                adminDb,
                existing.id,
                orgId,
                {
                  title: existing.title as string,
                  raw_content: existing.raw_content as string | null,
                  content_hash: existing.content_hash as string | null,
                  source_metadata: existing.source_metadata,
                },
                changes.changeType,
                changes.changedFields,
                `sync:${provider}`
              );

              item = existing;

              if (changes.contentChanged) {
                // Content changed — full re-process (extract + embed)
                await adminDb
                  .from("context_items")
                  .update({
                    raw_content: mergedContent,
                    title: record.title,
                    status: "processing",
                    content_hash: computeContentHash(mergedContent),
                    updated_at: new Date().toISOString(),
                    ...(record.sourceMetadata ? { source_metadata: record.sourceMetadata } : {}),
                  })
                  .eq("id", existing.id);
                // Continue to AI extraction + embedding below
              } else {
                // Metadata-only change — update metadata, skip expensive AI
                await adminDb
                  .from("context_items")
                  .update({
                    title: record.title,
                    updated_at: new Date().toISOString(),
                    ...(record.sourceMetadata ? { source_metadata: record.sourceMetadata } : {}),
                  })
                  .eq("id", existing.id);
                emit({ phase: "processing", current, total, title: record.title + " (metadata only)" });
                processed++;
                continue; // Skip AI extraction + embedding
              }
            } else {
              const { data: inserted, error } = await adminDb
                .from("context_items")
                .insert({
                  org_id: orgId,
                  source_type: provider,
                  source_id: record.id,
                  nango_connection_id: connectionId,
                  title: record.title,
                  raw_content: record.content,
                  content_type: contentType,
                  content_hash: computeContentHash(record.content),
                  status: "processing",
                  source_created_at: record.sourceCreatedAt ?? null,
                  ...(record.sourceMetadata ? { source_metadata: record.sourceMetadata } : {}),
                })
                .select("id")
                .single();

              if (error || !inserted) {
                debugLines.push(`DB insert error for "${record.title}": ${error?.message ?? "no row returned"}`);
                continue;
              }
              item = inserted;
            }

            try {
              // Check credits before AI processing
              if (creditsRemaining < creditCostPerItem) {
                emit({
                  phase: "processing",
                  current,
                  total,
                  title: record.title + " (skipped — insufficient credits)",
                });
                await adminDb.from("context_items").update({ status: "pending" }).eq("id", item.id);
                continue;
              }

              const [extraction, embedding] = await Promise.all([
                extractStructured(record.content, record.title),
                generateEmbedding(record.content),
              ]);

              await adminDb
                .from("context_items")
                .update({
                  title: extraction.title,
                  description_short: extraction.description_short,
                  description_long: extraction.description_long,
                  entities: extraction.entities,
                  embedding: embedding as unknown as string,
                  status: "ready",
                  processed_at: new Date().toISOString(),
                })
                .eq("id", item.id);

              // Deduct credits after successful AI processing
              try {
                creditsRemaining = await deductCredits(orgId, creditCostPerItem, `sync:${provider}`);
              } catch {
                // Deduction failed (race condition) — stop processing more
                emit({
                  phase: "processing",
                  current,
                  total,
                  title: record.title + " (credits exhausted)",
                });
                break;
              }

              await createInboxItems(adminDb, orgId, item.id, extraction, provider);
              processed++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              debugLines.push(`AI error for "${record.title}": ${msg}`);
              emit({ phase: "error", message: `Failed to process "${record.title}"`, title: record.title });
              await adminDb.from("context_items").update({ status: "error" }).eq("id", item.id);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            debugLines.push(`Error for "${record.title}": ${msg}`);
            emit({ phase: "error", message: `Error for "${record.title}": ${msg}`, title: record.title });
          }
        }

        if (processed > 0) {
          await adminDb
            .from("integrations")
            .update({ last_sync_at: new Date().toISOString() })
            .eq("nango_connection_id", connectionId);
        }

        emit({
          phase: "complete",
          processed,
          fetched: total,
          skipped: total - processed,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(sseEvent({ phase: "error", message: msg })));

        // Fire-and-forget: notify the user about the sync failure
        (async () => {
          try {
            const { notify } = await import("@/lib/notifications/notify");
            await notify({
              userId: user.id,
              orgId,
              type: "system_alert",
              title: `Sync failed: ${provider}`,
              body: `Error syncing ${provider}: ${msg.slice(0, 200)}`,
              link: "/settings/integrations",
              metadata: { provider, connection_id: connectionId, error: msg },
            });
          } catch { /* silent */ }
        })();
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
