/**
 * Shared types for all direct API integrations.
 * Each provider client exports its own specific types
 * but all return data compatible with the context_items table.
 */

/** Credential stored in the credentials table */
export interface StoredCredential {
  id: string;
  org_id: string;
  user_id: string | null;
  provider: string;
  token_encrypted: string;
  refresh_token_encrypted: string | null;
  expires_at: string | null;
}

/** Raw record ready for the ingestion pipeline */
export interface IngestableRecord {
  source_id: string;
  source_type: string;
  content_type: string;
  title: string;
  raw_content: string;
  source_created_at: string | null;
  source_metadata?: Record<string, unknown>;
}

/** Provider client interface — all providers implement this */
export interface ProviderClient {
  readonly provider: string;
  list(options?: { since?: string; limit?: number }): Promise<IngestableRecord[]>;
  get(id: string): Promise<IngestableRecord | null>;
}
