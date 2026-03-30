import type { IngestableRecord, ProviderClient } from './types';

const BASE_URL = 'https://public-api.granola.ai/v1';

interface GranolaNoteListItem {
  id: string; // not_ prefix
  title: string;
  created_at: string;
  updated_at: string;
  summary?: string;
  attendees?: { name?: string; email?: string }[];
}

interface GranolaNoteDetail extends GranolaNoteListItem {
  transcript?: string;
  notes?: string; // AI-generated summary/notes
}

interface GranolaPaginatedResponse {
  data: GranolaNoteListItem[];
  cursor?: string;
  has_more?: boolean;
}

export class GranolaClient implements ProviderClient {
  readonly provider = 'granola';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE_URL}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Granola API ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  /** List notes with optional pagination */
  async listNotes(options?: { since?: string; cursor?: string; limit?: number }): Promise<GranolaPaginatedResponse> {
    const params: Record<string, string> = {};
    if (options?.since) params.created_after = options.since;
    if (options?.cursor) params.cursor = options.cursor;
    if (options?.limit) params.limit = String(options.limit);

    return this.fetch<GranolaPaginatedResponse>('/notes', params);
  }

  /** Get a single note by ID */
  async getNote(id: string): Promise<GranolaNoteDetail> {
    return this.fetch<GranolaNoteDetail>(`/notes/${id}`);
  }

  /** Get a note with its full transcript */
  async getNoteWithTranscript(id: string): Promise<GranolaNoteDetail> {
    return this.fetch<GranolaNoteDetail>(`/notes/${id}`, { include: 'transcript' });
  }

  /** List notes as IngestableRecords for the processing pipeline */
  async list(options?: { since?: string; limit?: number }): Promise<IngestableRecord[]> {
    const records: IngestableRecord[] = [];
    let cursor: string | undefined;
    let total = 0;
    const maxRecords = options?.limit ?? 50;

    do {
      const page = await this.listNotes({
        since: options?.since,
        cursor,
        limit: Math.min(50, maxRecords - total),
      });

      for (const note of page.data) {
        if (total >= maxRecords) break;

        // Fetch full transcript for each note
        const detail = await this.getNoteWithTranscript(note.id);
        const transcript = detail.transcript ?? '';
        if (transcript.length < 50) continue; // Skip short/empty transcripts

        const attendeeNames = (detail.attendees ?? [])
          .map(a => a.name ?? a.email ?? '')
          .filter(Boolean);

        const attendeeLine = attendeeNames.length > 0
          ? `\n\nAttendees: ${attendeeNames.join(', ')}`
          : '';

        records.push({
          source_id: note.id,
          source_type: 'granola',
          content_type: 'meeting_transcript',
          title: note.title || 'Untitled meeting',
          raw_content: (transcript + attendeeLine).slice(0, 12000),
          source_created_at: note.created_at ?? null,
          source_metadata: {
            summary: detail.notes ?? detail.summary,
            attendees: attendeeNames,
          },
        });
        total++;
      }

      cursor = page.has_more ? page.cursor : undefined;
    } while (cursor && total < maxRecords);

    return records;
  }

  /** Get a single note as IngestableRecord */
  async get(id: string): Promise<IngestableRecord | null> {
    try {
      const detail = await this.getNoteWithTranscript(id);
      const transcript = detail.transcript ?? '';
      if (transcript.length < 50) return null;

      const attendeeNames = (detail.attendees ?? [])
        .map(a => a.name ?? a.email ?? '')
        .filter(Boolean);

      return {
        source_id: detail.id,
        source_type: 'granola',
        content_type: 'meeting_transcript',
        title: detail.title || 'Untitled meeting',
        raw_content: (transcript + (attendeeNames.length > 0 ? `\n\nAttendees: ${attendeeNames.join(', ')}` : '')).slice(0, 12000),
        source_created_at: detail.created_at ?? null,
        source_metadata: {
          summary: detail.notes ?? detail.summary,
          attendees: attendeeNames,
        },
      };
    } catch {
      return null;
    }
  }
}
