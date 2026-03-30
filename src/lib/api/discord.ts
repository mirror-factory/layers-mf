import type { IngestableRecord, ProviderClient } from './types';

const BASE_URL = 'https://discord.com/api/v10';

/** Maximum number of text channels to ingest in list() */
const MAX_CHANNELS = 5;

/** Minimum message content length to include */
const MIN_CONTENT_LENGTH = 20;

// --- Discord API response types ---

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  owner_id: string;
  member_count?: number;
}

interface DiscordChannel {
  id: string;
  guild_id?: string;
  name: string;
  type: number; // 0 = GUILD_TEXT, 2 = GUILD_VOICE, etc.
  topic: string | null;
  position: number;
  parent_id: string | null; // category channel ID
}

interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  bot?: boolean;
  discriminator: string;
}

interface DiscordMessage {
  id: string;
  channel_id: string;
  author: DiscordUser;
  content: string;
  timestamp: string;
  edited_timestamp: string | null;
  type: number; // 0 = DEFAULT, 19 = REPLY, etc.
  attachments: { url: string; filename: string }[];
  embeds: unknown[];
}

// Channel type constants
const CHANNEL_TYPE_GUILD_TEXT = 0;
const CHANNEL_TYPE_GUILD_ANNOUNCEMENT = 5;

const TEXT_CHANNEL_TYPES = new Set([
  CHANNEL_TYPE_GUILD_TEXT,
  CHANNEL_TYPE_GUILD_ANNOUNCEMENT,
]);

export class DiscordClient implements ProviderClient {
  readonly provider = 'discord';
  private botToken: string;
  private guildId: string;

  constructor(botToken: string, guildId: string) {
    this.botToken = botToken;
    this.guildId = guildId;
  }

  private async fetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE_URL}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bot ${this.botToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Discord API ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  /** Get guild (server) info */
  async getGuild(): Promise<DiscordGuild> {
    return this.fetch<DiscordGuild>(`/guilds/${this.guildId}`, {
      with_counts: 'true',
    });
  }

  /** Get a single channel's info */
  async getChannel(channelId: string): Promise<DiscordChannel> {
    return this.fetch<DiscordChannel>(`/channels/${channelId}`);
  }

  /** List all text channels in the guild */
  async listChannels(): Promise<DiscordChannel[]> {
    const channels = await this.fetch<DiscordChannel[]>(
      `/guilds/${this.guildId}/channels`
    );

    return channels
      .filter((ch) => TEXT_CHANNEL_TYPES.has(ch.type))
      .sort((a, b) => a.position - b.position);
  }

  /** Get recent messages from a channel */
  async getMessages(channelId: string, limit = 50): Promise<DiscordMessage[]> {
    const clampedLimit = Math.min(Math.max(1, limit), 100);
    return this.fetch<DiscordMessage[]>(`/channels/${channelId}/messages`, {
      limit: String(clampedLimit),
    });
  }

  /**
   * Concatenate messages from up to MAX_CHANNELS text channels into IngestableRecords.
   * Each channel becomes one record with messages joined chronologically.
   */
  async list(options?: { since?: string; limit?: number }): Promise<IngestableRecord[]> {
    const channels = await this.listChannels();
    const selectedChannels = channels.slice(0, MAX_CHANNELS);
    const maxRecords = options?.limit ?? selectedChannels.length;

    const records: IngestableRecord[] = [];

    for (const channel of selectedChannels) {
      if (records.length >= maxRecords) break;

      const record = await this.buildChannelRecord(channel.id, channel.name, options?.since);
      if (record) {
        records.push(record);
      }
    }

    return records;
  }

  /** Get messages from a single channel as an IngestableRecord */
  async get(channelId: string): Promise<IngestableRecord | null> {
    try {
      const channel = await this.getChannel(channelId);
      return this.buildChannelRecord(channelId, channel.name);
    } catch {
      return null;
    }
  }

  /**
   * Build an IngestableRecord from a channel's messages.
   * Filters out bot messages and short content (<20 chars).
   * Concatenates messages in chronological order.
   */
  private async buildChannelRecord(
    channelId: string,
    channelName: string,
    since?: string,
  ): Promise<IngestableRecord | null> {
    const messages = await this.getMessages(channelId, 100);

    const sinceDate = since ? new Date(since) : null;

    const filtered = messages
      .filter((msg) => {
        if (msg.author.bot) return false;
        if (msg.content.length < MIN_CONTENT_LENGTH) return false;
        if (sinceDate && new Date(msg.timestamp) < sinceDate) return false;
        return true;
      })
      // Messages come newest-first from Discord API; reverse to chronological
      .reverse();

    if (filtered.length === 0) return null;

    const formattedMessages = filtered.map((msg) => {
      const displayName = msg.author.global_name ?? msg.author.username;
      const date = new Date(msg.timestamp).toISOString().slice(0, 16).replace('T', ' ');
      return `[${date}] ${displayName}: ${msg.content}`;
    });

    const rawContent = formattedMessages.join('\n').slice(0, 12000);

    const oldestTimestamp = filtered[0]?.timestamp ?? null;

    return {
      source_id: `discord-channel-${channelId}`,
      source_type: 'discord',
      content_type: 'channel_messages',
      title: `#${channelName}`,
      raw_content: rawContent,
      source_created_at: oldestTimestamp,
      source_metadata: {
        channel_id: channelId,
        channel_name: channelName,
        message_count: filtered.length,
        guild_id: this.guildId,
      },
    };
  }
}
