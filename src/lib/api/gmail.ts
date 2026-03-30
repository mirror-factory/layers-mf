import { google } from 'googleapis';
import type { IngestableRecord, ProviderClient } from './types';
import { getAuthenticatedClient } from './google-auth';

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  snippet: string;
}

export class GmailClient implements ProviderClient {
  readonly provider = 'gmail';
  private gmail;

  constructor(accessToken: string, refreshToken?: string) {
    const auth = getAuthenticatedClient(accessToken, refreshToken);
    this.gmail = google.gmail({ version: 'v1', auth });
  }

  /** Search emails with Gmail query syntax */
  async searchEmails(
    query: string,
    maxResults = 20,
  ): Promise<GmailMessage[]> {
    const res = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });

    const messages: GmailMessage[] = [];
    for (const msg of res.data.messages ?? []) {
      const detail = await this.gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full',
      });
      messages.push(this.parseMessage(detail.data));
    }
    return messages;
  }

  /** Get a single email by ID */
  async getMessage(id: string): Promise<GmailMessage | null> {
    try {
      const detail = await this.gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });
      return this.parseMessage(detail.data);
    } catch {
      return null;
    }
  }

  /** Create a draft email */
  async createDraft(
    to: string,
    subject: string,
    body: string,
  ): Promise<{ id: string }> {
    const raw = this.encodeMessage(to, subject, body);
    const res = await this.gmail.users.drafts.create({
      userId: 'me',
      requestBody: { message: { raw } },
    });
    return { id: res.data.id! };
  }

  /** Parse Gmail message into structured format */
  private parseMessage(msg: gmail_v1_Message): GmailMessage {
    const headers = msg.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find(
        (h) => h.name?.toLowerCase() === name.toLowerCase(),
      )?.value ?? '';
    const body = this.extractBody(msg.payload);

    return {
      id: msg.id ?? '',
      threadId: msg.threadId ?? '',
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      body: body.slice(0, 12_000),
      snippet: msg.snippet ?? '',
    };
  }

  /** Extract body text from MIME parts */
  private extractBody(payload: gmail_v1_MessagePart | undefined): string {
    if (!payload) return '';

    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
    }
    if (payload.parts) {
      const textPart = payload.parts.find(
        (p) => p.mimeType === 'text/plain',
      );
      if (textPart?.body?.data) {
        return Buffer.from(textPart.body.data, 'base64url').toString('utf-8');
      }
      const htmlPart = payload.parts.find(
        (p) => p.mimeType === 'text/html',
      );
      if (htmlPart?.body?.data) {
        return Buffer.from(htmlPart.body.data, 'base64url')
          .toString('utf-8')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }
    return '';
  }

  /** Base64url encode an email for the Gmail API */
  private encodeMessage(to: string, subject: string, body: string): string {
    const msg = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');
    return Buffer.from(msg).toString('base64url');
  }

  /** ProviderClient: list recent emails */
  async list(options?: {
    since?: string;
    limit?: number;
  }): Promise<IngestableRecord[]> {
    const query = options?.since
      ? `after:${options.since.split('T')[0]}`
      : 'newer_than:7d';
    const messages = await this.searchEmails(query, options?.limit ?? 20);

    return messages.map((msg) => ({
      source_id: msg.id,
      source_type: 'gmail',
      content_type: 'message' as const,
      title: `${msg.subject} — from ${msg.from}`,
      raw_content: msg.body.slice(0, 12_000),
      source_created_at: msg.date
        ? new Date(msg.date).toISOString()
        : null,
      source_metadata: {
        from: msg.from,
        to: msg.to,
        threadId: msg.threadId,
      },
    }));
  }

  async get(id: string): Promise<IngestableRecord | null> {
    const msg = await this.getMessage(id);
    if (!msg) return null;
    return {
      source_id: msg.id,
      source_type: 'gmail',
      content_type: 'message',
      title: `${msg.subject} — from ${msg.from}`,
      raw_content: msg.body.slice(0, 12_000),
      source_created_at: msg.date
        ? new Date(msg.date).toISOString()
        : null,
    };
  }
}

// Internal type aliases for Gmail API shapes
type gmail_v1_Message = {
  id?: string | null;
  threadId?: string | null;
  snippet?: string | null;
  payload?: gmail_v1_MessagePart;
};

type gmail_v1_MessagePart = {
  mimeType?: string | null;
  headers?: Array<{ name?: string | null; value?: string | null }>;
  body?: { data?: string | null };
  parts?: gmail_v1_MessagePart[];
};
