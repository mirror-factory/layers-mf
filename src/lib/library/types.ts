export const MCP_INGESTION_MODES = [
  "live_lookup",
  "save_selected",
  "sync_rule",
] as const;

export type McpIngestionMode = (typeof MCP_INGESTION_MODES)[number];

export type LibrarySourceInput = {
  sourceKind: string;
  provider?: string;
  mcpServerId?: string;
  externalId?: string;
  externalUrl?: string;
  importMode?: McpIngestionMode | "manual" | "upload" | "chat_save" | "artifact" | "generated";
  sourceCreatedAt?: string;
  sourceUpdatedAt?: string;
  license?: string;
  prompt?: string;
  model?: string;
  metadata?: Record<string, unknown>;
};

export type LibraryAssetInput = {
  id?: string;
  kind?: "image" | "file" | "generated_image" | "screenshot" | "diagram" | "whiteboard" | "artifact_preview" | "external_media";
  title?: string;
  storageBucket?: string;
  storagePath?: string;
  originalUrl?: string;
  thumbnailPath?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  sha256?: string;
  altText?: string;
  caption?: string;
  ocrText?: string;
  prompt?: string;
  model?: string;
  license?: string;
  metadata?: Record<string, unknown>;
  role?: string;
};

export type CreateLibraryItemInput = {
  orgId: string;
  userId?: string;
  title: string;
  body?: string;
  summary?: string;
  itemType?: string;
  contentType?: string;
  sourceType?: string;
  sourceId?: string;
  source?: LibrarySourceInput;
  stackIds?: string[];
  tags?: string[];
  assets?: LibraryAssetInput[];
  permissions?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: "pending" | "processing" | "ready" | "error";
};

export type LibraryItem = {
  id: string;
  orgId: string;
  title: string;
  body: string | null;
  summary: string | null;
  itemType: string;
  contentType: string;
  sourceType: string;
  sourceId: string | null;
  sourceMetadata: Record<string, unknown>;
  status: string;
  permissions: Record<string, unknown>;
  scope: string;
  createdAt: string | null;
  processedAt: string | null;
};

export type Stack = {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isSmart: boolean;
};

export type ContextPackInput = {
  orgId: string;
  userId?: string;
  name: string;
  purpose?: string;
  visibility?: "private" | "org" | "external";
  retrievalQuery?: string;
  instructions?: string;
  itemIds?: string[];
  metadata?: Record<string, unknown>;
};

export type DeweyProfile = {
  id?: string;
  orgId: string;
  name: string;
  voice: string;
  tone: string;
  allowedTools: string[];
  approvalPolicy: string;
  defaultRetrievalScope: Record<string, unknown>;
  memoryPolicy: Record<string, unknown>;
  saveBehavior: "never" | "suggest_then_save" | "auto_low_risk";
  instructions: string | null;
};

export type LayersMcpToolName =
  | "search_library"
  | "get_library_item"
  | "add_library_item"
  | "list_stacks"
  | "create_stack"
  | "save_asset"
  | "ask_dewey"
  | "create_context_pack"
  | "list_context_packs"
  | "create_artifact"
  | "run_sandbox"
  | "propose_action"
  | "execute_approved_action";
