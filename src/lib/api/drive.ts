import { google } from 'googleapis';
import type { IngestableRecord, ProviderClient } from './types';
import { getAuthenticatedClient } from './google-auth';

const EXPORTABLE_TYPES: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
};

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string | null;
  modifiedTime: string | null;
}

export class DriveClient implements ProviderClient {
  readonly provider = 'drive';
  private drive;

  constructor(accessToken: string, refreshToken?: string) {
    const auth = getAuthenticatedClient(accessToken, refreshToken);
    this.drive = google.drive({ version: 'v3', auth });
  }

  /** List files with optional query */
  async listFiles(query?: string, limit = 50): Promise<DriveFile[]> {
    const q =
      query ??
      "trashed=false and (mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.presentation')";

    const res = await this.drive.files.list({
      q,
      fields: 'files(id,name,mimeType,createdTime,modifiedTime)',
      pageSize: limit,
      orderBy: 'modifiedTime desc',
    });

    return (res.data.files ?? []).map((f) => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      createdTime: f.createdTime ?? null,
      modifiedTime: f.modifiedTime ?? null,
    }));
  }

  /** Export a Google Workspace file to text */
  async exportFile(fileId: string, mimeType: string): Promise<string> {
    const exportMime = EXPORTABLE_TYPES[mimeType];
    if (!exportMime) throw new Error(`Cannot export ${mimeType}`);

    const res = await this.drive.files.export({
      fileId,
      mimeType: exportMime,
    });

    return typeof res.data === 'string' ? res.data : String(res.data);
  }

  /** ProviderClient: list exportable files */
  async list(options?: {
    since?: string;
    limit?: number;
  }): Promise<IngestableRecord[]> {
    const files = await this.listFiles(undefined, options?.limit ?? 50);
    const records: IngestableRecord[] = [];

    for (const file of files) {
      if (!EXPORTABLE_TYPES[file.mimeType]) continue;
      try {
        const content = await this.exportFile(file.id, file.mimeType);
        if (content.trim().length < 30) continue;
        records.push({
          source_id: file.id,
          source_type: 'gdrive',
          content_type: 'document',
          title: file.name,
          raw_content: content.slice(0, 12_000),
          source_created_at: file.createdTime,
        });
      } catch {
        /* skip files that fail to export */
      }
    }
    return records;
  }

  async get(id: string): Promise<IngestableRecord | null> {
    try {
      const res = await this.drive.files.get({
        fileId: id,
        fields: 'id,name,mimeType,createdTime',
      });
      const file = res.data;
      if (!file.mimeType || !EXPORTABLE_TYPES[file.mimeType]) return null;
      const content = await this.exportFile(id, file.mimeType);
      if (content.trim().length < 30) return null;
      return {
        source_id: file.id!,
        source_type: 'gdrive',
        content_type: 'document',
        title: file.name!,
        raw_content: content.slice(0, 12_000),
        source_created_at: file.createdTime ?? null,
      };
    } catch {
      return null;
    }
  }
}
