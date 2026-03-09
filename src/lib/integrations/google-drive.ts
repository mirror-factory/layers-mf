import { nango } from "@/lib/nango/client";
import { createAdminClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

/**
 * Google Drive push notification channel management.
 *
 * Uses Nango proxy to call Drive API endpoints for watching changes.
 * Watch channels expire after 24h and must be renewed.
 */

const WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/google-drive`
  : "https://local.hustletogether.com/api/webhooks/google-drive";

// Watch channels expire after 24h (Google's max for non-verified domains)
const WATCH_EXPIRY_MS = 24 * 60 * 60 * 1000;

interface WatchChannelMeta {
  channelId: string;
  resourceId: string;
  expiration: string; // ISO date
}

/**
 * Register a Drive API watch channel for push notifications.
 * Stores the channel metadata in the integration's sync_config.
 */
export async function registerDriveWatch(
  connectionId: string,
  provider: string,
  orgId: string
): Promise<WatchChannelMeta | null> {
  const adminDb = createAdminClient();

  // First, get the start page token so we can track changes from now
  let startPageToken: string;
  try {
    const tokenRes = await nango.proxy<{ startPageToken: string }>({
      method: "GET",
      providerConfigKey: provider,
      connectionId,
      endpoint: "/drive/v3/changes/startPageToken",
    });
    startPageToken = tokenRes.data.startPageToken;
  } catch (err) {
    console.error("[google-drive] Failed to get startPageToken:", err);
    return null;
  }

  const channelId = randomUUID();
  const expiration = Date.now() + WATCH_EXPIRY_MS;

  try {
    const res = await nango.proxy<{
      id: string;
      resourceId: string;
      expiration: string;
    }>({
      method: "POST",
      providerConfigKey: provider,
      connectionId,
      endpoint: "/drive/v3/changes/watch",
      params: { pageToken: startPageToken },
      data: {
        id: channelId,
        type: "web_hook",
        address: WEBHOOK_URL,
        expiration: String(expiration),
      },
    });

    const meta: WatchChannelMeta = {
      channelId: res.data.id,
      resourceId: res.data.resourceId,
      expiration: new Date(Number(res.data.expiration)).toISOString(),
    };

    // Store watch metadata + page token on the integration's sync_config
    await adminDb
      .from("integrations")
      .update({
        sync_config: {
          watch: { channelId: meta.channelId, resourceId: meta.resourceId, expiration: meta.expiration },
          startPageToken,
        },
      })
      .eq("nango_connection_id", connectionId)
      .eq("org_id", orgId);

    console.log(`[google-drive] Watch registered: channel=${meta.channelId}`);
    return meta;
  } catch (err) {
    console.error("[google-drive] Failed to register watch:", err);
    return null;
  }
}

/**
 * Stop a Drive API watch channel.
 */
export async function unregisterDriveWatch(
  channelId: string,
  resourceId: string,
  connectionId: string,
  provider: string
): Promise<boolean> {
  try {
    await nango.proxy({
      method: "POST",
      providerConfigKey: provider,
      connectionId,
      endpoint: "/drive/v3/channels/stop",
      data: {
        id: channelId,
        resourceId,
      },
    });
    console.log(`[google-drive] Watch stopped: channel=${channelId}`);
    return true;
  } catch (err) {
    console.error("[google-drive] Failed to stop watch:", err);
    return false;
  }
}

/**
 * Renew an expiring watch channel.
 * Stops the old channel, registers a new one.
 */
export async function renewDriveWatch(
  connectionId: string,
  provider: string,
  orgId: string
): Promise<WatchChannelMeta | null> {
  const adminDb = createAdminClient();

  // Look up existing watch metadata from sync_config
  const { data: integration } = await adminDb
    .from("integrations")
    .select("sync_config")
    .eq("nango_connection_id", connectionId)
    .eq("org_id", orgId)
    .single();

  const syncConfig = integration?.sync_config as Record<string, unknown> | null;
  const meta = syncConfig?.watch as WatchChannelMeta | undefined;

  // Stop old channel if it exists
  if (meta?.channelId && meta?.resourceId) {
    await unregisterDriveWatch(meta.channelId, meta.resourceId, connectionId, provider);
  }

  // Register a fresh channel
  return registerDriveWatch(connectionId, provider, orgId);
}

/**
 * Fetch incremental changes from Drive since the last sync.
 * Returns changed files and the new page token.
 */
export async function fetchDriveChanges(
  connectionId: string,
  provider: string,
  pageToken: string
): Promise<{
  files: DriveChangedFile[];
  newStartPageToken: string | null;
}> {
  const files: DriveChangedFile[] = [];
  let currentToken = pageToken;
  let newStartPageToken: string | null = null;

  // Paginate through all changes
  while (currentToken) {
    const res = await nango.proxy<{
      changes: {
        fileId: string;
        removed: boolean;
        file?: {
          id: string;
          name: string;
          mimeType: string;
          createdTime?: string;
          modifiedTime?: string;
          webViewLink?: string;
          size?: string;
          lastModifyingUser?: { displayName?: string; emailAddress?: string };
        };
      }[];
      newStartPageToken?: string;
      nextPageToken?: string;
    }>({
      method: "GET",
      providerConfigKey: provider,
      connectionId,
      endpoint: "/drive/v3/changes",
      params: {
        pageToken: currentToken,
        fields:
          "changes(fileId,removed,file(id,name,mimeType,createdTime,modifiedTime,webViewLink,size,lastModifyingUser)),newStartPageToken,nextPageToken",
        pageSize: "100",
        includeRemoved: "false",
      },
    });

    for (const change of res.data.changes ?? []) {
      if (change.removed || !change.file) continue;
      files.push(change.file as DriveChangedFile);
    }

    if (res.data.newStartPageToken) {
      newStartPageToken = res.data.newStartPageToken;
      break;
    }

    currentToken = res.data.nextPageToken ?? "";
  }

  return { files, newStartPageToken };
}

export interface DriveChangedFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
  lastModifyingUser?: { displayName?: string; emailAddress?: string };
}
