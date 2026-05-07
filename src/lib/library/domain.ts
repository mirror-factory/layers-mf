import { searchContext } from "@/lib/db/search";
import type {
  ContextPackInput,
  CreateLibraryItemInput,
  DeweyProfile,
  LibraryAssetInput,
  LibraryItem,
  McpIngestionMode,
  Stack,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export function toLibraryItem(row: Record<string, any>): LibraryItem {
  return {
    id: row.id,
    orgId: row.org_id,
    title: row.title,
    body: row.raw_content ?? null,
    summary: row.summary ?? row.description_long ?? row.description_short ?? null,
    itemType: row.library_item_type ?? row.content_type ?? "document",
    contentType: row.content_type ?? "document",
    sourceType: row.source_type ?? "manual",
    sourceId: row.source_id ?? null,
    sourceMetadata: row.source_metadata ?? {},
    status: row.status ?? "ready",
    permissions: row.permissions ?? {},
    scope: row.library_scope ?? "org",
    createdAt: row.ingested_at ?? row.created_at ?? null,
    processedAt: row.processed_at ?? null,
  };
}

export function describeMcpIngestionMode(mode: McpIngestionMode) {
  switch (mode) {
    case "live_lookup":
      return {
        savesToLibrary: false,
        requiresSelection: false,
        durable: false,
        label: "Live Lookup",
        description: "Dewey queries the MCP and answers without saving results.",
      };
    case "save_selected":
      return {
        savesToLibrary: true,
        requiresSelection: true,
        durable: false,
        label: "Save Selected",
        description: "Dewey presents MCP results and only selected records become Library Items.",
      };
    case "sync_rule":
      return {
        savesToLibrary: true,
        requiresSelection: false,
        durable: true,
        label: "Sync Rule",
        description: "A durable rule keeps selected external records synced into the Library.",
      };
  }
}

function normalizeContentType(itemType?: string, contentType?: string): string {
  if (contentType) return contentType;
  if (!itemType) return "document";
  if (itemType === "meeting" || itemType === "meeting_transcript") return "meeting_transcript";
  if (itemType === "issue" || itemType === "task") return "issue";
  if (itemType === "image" || itemType === "file") return "file";
  return itemType;
}

function buildSourceMetadata(input: CreateLibraryItemInput): Record<string, unknown> {
  return {
    ...(input.metadata ?? {}),
    library: {
      itemType: input.itemType ?? input.contentType ?? "document",
      source: input.source ?? null,
    },
  };
}

export async function createLibraryItem(
  supabase: AnySupabase,
  input: CreateLibraryItemInput,
): Promise<{ item: LibraryItem } | { error: string }> {
  if (!input.title.trim()) return { error: "Title is required" };

  const sourceType = input.sourceType ?? input.source?.provider ?? input.source?.sourceKind ?? "manual";
  const sourceId = input.sourceId ?? input.source?.externalId ?? null;
  const contentType = normalizeContentType(input.itemType, input.contentType);
  const summary = input.summary ?? null;

  const { data: row, error } = await supabase
    .from("context_items")
    .insert({
      org_id: input.orgId,
      source_type: sourceType,
      source_id: sourceId,
      title: input.title,
      description_short: summary ? summary.slice(0, 500) : null,
      description_long: summary,
      summary,
      raw_content: input.body ?? "",
      content_type: contentType,
      library_item_type: input.itemType ?? contentType,
      library_scope: "org",
      permissions: input.permissions ?? {},
      source_metadata: buildSourceMetadata(input),
      source_created_at: input.source?.sourceCreatedAt ?? null,
      status: input.status ?? "ready",
      processed_at: input.status === "pending" || input.status === "processing" ? null : new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !row) return { error: error?.message ?? "Failed to create Library Item" };

  const item = toLibraryItem(row);

  await Promise.allSettled([
    input.source ? saveSource(supabase, item.id, input) : Promise.resolve(),
    input.stackIds?.length ? assignItemToStacks(supabase, input.orgId, item.id, input.stackIds, input.userId) : Promise.resolve(),
    input.tags?.length ? assignTags(supabase, input.orgId, item.id, input.tags, input.userId) : Promise.resolve(),
    input.assets?.length ? saveAndAttachAssets(supabase, input.orgId, item.id, input.assets, input.userId) : Promise.resolve(),
    writeAudit(supabase, {
      orgId: input.orgId,
      userId: input.userId,
      action: "library.item.created",
      resourceType: "context_item",
      resourceId: item.id,
      metadata: { sourceType, contentType },
    }),
  ]);

  return { item };
}

async function saveSource(
  supabase: AnySupabase,
  contextItemId: string,
  input: CreateLibraryItemInput,
) {
  const source = input.source;
  if (!source) return;

  await supabase.from("library_sources").insert({
    org_id: input.orgId,
    context_item_id: contextItemId,
    source_kind: source.sourceKind,
    provider: source.provider ?? null,
    mcp_server_id: source.mcpServerId ?? null,
    external_id: source.externalId ?? null,
    external_url: source.externalUrl ?? null,
    import_mode: source.importMode ?? "manual",
    imported_by: input.userId ?? null,
    source_created_at: source.sourceCreatedAt ?? null,
    source_updated_at: source.sourceUpdatedAt ?? null,
    license: source.license ?? null,
    prompt: source.prompt ?? null,
    model: source.model ?? null,
    metadata: source.metadata ?? {},
  });
}

export async function getLibraryItem(
  supabase: AnySupabase,
  orgId: string,
  itemId: string,
) {
  const { data: item, error } = await supabase
    .from("context_items")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", itemId)
    .single();

  if (error || !item) return { error: "Library Item not found" };

  const [stacks, tags, assets, sources, relationships] = await Promise.all([
    getItemStacks(supabase, itemId),
    getItemTags(supabase, itemId),
    getItemAssets(supabase, itemId),
    getItemSources(supabase, orgId, itemId),
    getItemRelationships(supabase, orgId, itemId),
  ]);

  return {
    item: toLibraryItem(item),
    stacks,
    tags,
    assets,
    sources,
    relationships,
  };
}

export async function listLibraryItems(
  supabase: AnySupabase,
  orgId: string,
  options: { limit?: number; offset?: number; itemType?: string; stackId?: string; query?: string } = {},
) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  if (options.query?.trim()) {
    const results = await searchContext(
      supabase,
      orgId,
      options.query.trim(),
      limit,
      options.itemType ? { contentType: options.itemType } : undefined,
      true,
    );
    return { items: results.map((result) => ({ ...result, itemType: result.content_type })) };
  }

  let query = supabase
    .from("context_items")
    .select("*")
    .eq("org_id", orgId)
    .is("archived_at", null)
    .order("ingested_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options.itemType) {
    query = query.eq("library_item_type", options.itemType);
  }

  if (options.stackId) {
    const { data: links, error: linkError } = await supabase
      .from("collection_items")
      .select("context_item_id")
      .eq("collection_id", options.stackId);
    if (linkError) return { error: linkError.message };
    const ids = (links ?? []).map((link: { context_item_id: string }) => link.context_item_id);
    if (ids.length === 0) return { items: [] };
    query = query.in("id", ids);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };
  return { items: (data ?? []).map(toLibraryItem) };
}

export async function listStacks(supabase: AnySupabase, orgId: string): Promise<{ stacks: Stack[] } | { error: string }> {
  const { data, error } = await supabase
    .from("collections")
    .select("id, org_id, name, description, icon, color, is_smart")
    .eq("org_id", orgId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return { error: error.message };

  return {
    stacks: (data ?? []).map((row: Record<string, any>) => ({
      id: row.id,
      orgId: row.org_id,
      name: row.name,
      description: row.description ?? null,
      icon: row.icon ?? null,
      color: row.color ?? null,
      isSmart: Boolean(row.is_smart),
    })),
  };
}

export async function createStack(
  supabase: AnySupabase,
  input: { orgId: string; userId: string; name: string; description?: string; icon?: string; color?: string },
) {
  if (!input.name.trim()) return { error: "Stack name is required" };

  const { data, error } = await supabase
    .from("collections")
    .insert({
      org_id: input.orgId,
      name: input.name.trim(),
      description: input.description ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
      created_by: input.userId,
    })
    .select("id, org_id, name, description, icon, color, is_smart")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create Stack" };

  await writeAudit(supabase, {
    orgId: input.orgId,
    userId: input.userId,
    action: "library.stack.created",
    resourceType: "collection",
    resourceId: data.id,
    metadata: { name: data.name },
  });

  return {
    stack: {
      id: data.id,
      orgId: data.org_id,
      name: data.name,
      description: data.description ?? null,
      icon: data.icon ?? null,
      color: data.color ?? null,
      isSmart: Boolean(data.is_smart),
    } satisfies Stack,
  };
}

async function assignItemToStacks(
  supabase: AnySupabase,
  orgId: string,
  itemId: string,
  stackIds: string[],
  userId?: string,
) {
  const uniqueIds = [...new Set(stackIds)].filter(Boolean);
  if (uniqueIds.length === 0) return;

  const rows = uniqueIds.map((collectionId) => ({
    collection_id: collectionId,
    context_item_id: itemId,
    added_by: userId ?? null,
  }));

  await supabase.from("collection_items").upsert(rows, {
    onConflict: "collection_id,context_item_id",
    ignoreDuplicates: true,
  });

  await writeAudit(supabase, {
    orgId,
    userId,
    action: "library.item.assigned_to_stacks",
    resourceType: "context_item",
    resourceId: itemId,
    metadata: { stackIds: uniqueIds },
  });
}

async function assignTags(
  supabase: AnySupabase,
  orgId: string,
  itemId: string,
  tags: string[],
  userId?: string,
) {
  const names = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  if (names.length === 0) return;

  await supabase.from("tags").upsert(
    names.map((name) => ({ org_id: orgId, name, created_by: userId ?? null })),
    { onConflict: "org_id,name", ignoreDuplicates: true },
  );

  const { data: tagRows } = await supabase
    .from("tags")
    .select("id, name")
    .eq("org_id", orgId)
    .in("name", names);

  const itemTagRows = (tagRows ?? []).map((tag: { id: string }) => ({
    context_item_id: itemId,
    tag_id: tag.id,
    source: "user",
    confidence: 1,
  }));

  if (itemTagRows.length > 0) {
    await supabase.from("item_tags").upsert(itemTagRows, {
      onConflict: "context_item_id,tag_id",
      ignoreDuplicates: true,
    });
  }
}

export async function saveLibraryAsset(
  supabase: AnySupabase,
  orgId: string,
  userId: string | undefined,
  asset: LibraryAssetInput,
) {
  if (asset.id) return { assetId: asset.id };

  const { data, error } = await supabase
    .from("library_assets")
    .insert({
      org_id: orgId,
      created_by: userId ?? null,
      kind: asset.kind ?? "file",
      title: asset.title ?? null,
      storage_bucket: asset.storageBucket ?? null,
      storage_path: asset.storagePath ?? null,
      original_url: asset.originalUrl ?? null,
      thumbnail_path: asset.thumbnailPath ?? null,
      mime_type: asset.mimeType ?? null,
      size_bytes: asset.sizeBytes ?? null,
      width: asset.width ?? null,
      height: asset.height ?? null,
      sha256: asset.sha256 ?? null,
      alt_text: asset.altText ?? null,
      caption: asset.caption ?? null,
      ocr_text: asset.ocrText ?? null,
      prompt: asset.prompt ?? null,
      model: asset.model ?? null,
      license: asset.license ?? null,
      metadata: asset.metadata ?? {},
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to save asset" };
  return { assetId: data.id };
}

export async function attachAssetToLibraryItem(
  supabase: AnySupabase,
  input: {
    orgId: string;
    itemId: string;
    assetId: string;
    role?: string;
    sortOrder?: number;
  },
) {
  const { error } = await supabase.from("library_item_assets").upsert(
    {
      org_id: input.orgId,
      context_item_id: input.itemId,
      asset_id: input.assetId,
      role: input.role ?? "attachment",
      sort_order: input.sortOrder ?? 0,
    },
    {
      onConflict: "context_item_id,asset_id,role",
      ignoreDuplicates: true,
    },
  );

  if (error) return { error: error.message };
  return { attached: true };
}

export async function addLibrarySource(
  supabase: AnySupabase,
  input: {
    orgId: string;
    itemId: string;
    userId?: string;
    source: NonNullable<CreateLibraryItemInput["source"]>;
  },
) {
  const source = input.source;
  const { error } = await supabase
    .from("library_sources")
    .insert({
      org_id: input.orgId,
      context_item_id: input.itemId,
      source_kind: source.sourceKind,
      provider: source.provider ?? null,
      mcp_server_id: source.mcpServerId ?? null,
      external_id: source.externalId ?? null,
      external_url: source.externalUrl ?? null,
      import_mode: source.importMode ?? "manual",
      imported_by: input.userId ?? null,
      source_created_at: source.sourceCreatedAt ?? null,
      source_updated_at: source.sourceUpdatedAt ?? null,
      license: source.license ?? null,
      prompt: source.prompt ?? null,
      model: source.model ?? null,
      metadata: source.metadata ?? {},
    });

  if (error && error.code !== "23505") return { error: error.message };
  return { sourceSaved: true };
}

export async function assignLibraryItemToStacks(
  supabase: AnySupabase,
  input: {
    orgId: string;
    itemId: string;
    stackIds: string[];
    userId?: string;
  },
) {
  await assignItemToStacks(supabase, input.orgId, input.itemId, input.stackIds, input.userId);
  return { assigned: true };
}

async function saveAndAttachAssets(
  supabase: AnySupabase,
  orgId: string,
  itemId: string,
  assets: LibraryAssetInput[],
  userId?: string,
) {
  const rows = [];
  for (const asset of assets) {
    const result = await saveLibraryAsset(supabase, orgId, userId, asset);
    if ("assetId" in result) {
      rows.push({
        org_id: orgId,
        context_item_id: itemId,
        asset_id: result.assetId,
        role: asset.role ?? "attachment",
      });
    }
  }

  if (rows.length > 0) {
    await supabase.from("library_item_assets").upsert(rows, {
      onConflict: "context_item_id,asset_id,role",
      ignoreDuplicates: true,
    });
  }
}

export async function saveArtifactBackToLibrary(
  supabase: AnySupabase,
  input: {
    orgId: string;
    userId?: string;
    artifactId: string;
    stackIds?: string[];
    tags?: string[];
    reason?: string;
  },
) {
  const { data: artifact, error: artifactError } = await supabase
    .from("artifacts")
    .select("id, title, type, content, language, framework, description_short, description_oneliner, preview_url, snapshot_id, run_command, expose_port, current_version, updated_at, created_at")
    .eq("id", input.artifactId)
    .eq("org_id", input.orgId)
    .single();

  if (artifactError || !artifact) return { error: "Artifact not found" };

  const { data: files } = await supabase
    .from("artifact_files")
    .select("file_path, content, language")
    .eq("artifact_id", input.artifactId)
    .eq("version_number", artifact.current_version ?? 1)
    .order("file_path", { ascending: true });

  const fileBody = (files ?? [])
    .map((file: { file_path: string; content: string }) => `// ${file.file_path}\n${file.content}`)
    .join("\n\n");
  const body = [
    artifact.content,
    fileBody,
  ].filter(Boolean).join("\n\n").slice(0, 200000);
  const summary =
    artifact.description_short ??
    artifact.description_oneliner ??
    `Artifact saved from ${artifact.type ?? "generated work"}`;

  const { data: existing } = await supabase
    .from("context_items")
    .select("*")
    .eq("org_id", input.orgId)
    .eq("source_type", "artifact")
    .eq("source_id", input.artifactId)
    .maybeSingle();

  let item: LibraryItem;
  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from("context_items")
      .update({
        title: artifact.title,
        raw_content: [artifact.title, summary, body].filter(Boolean).join("\n\n"),
        description_short: summary.slice(0, 500),
        description_long: summary,
        summary,
        content_type: artifact.type === "document" ? "document" : "file",
        library_item_type: "artifact",
        source_metadata: {
          ...(existing.source_metadata ?? {}),
          artifact: {
            id: artifact.id,
            type: artifact.type,
            language: artifact.language,
            framework: artifact.framework,
            version: artifact.current_version,
            previewUrl: artifact.preview_url,
            snapshotId: artifact.snapshot_id,
            savedBackReason: input.reason ?? null,
          },
        },
        processed_at: new Date().toISOString(),
        status: "ready",
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateError || !updated) return { error: updateError?.message ?? "Failed to update Library Item" };
    item = toLibraryItem(updated);
  } else {
    const result = await createLibraryItem(supabase, {
      orgId: input.orgId,
      userId: input.userId,
      title: artifact.title,
      body,
      summary,
      itemType: "artifact",
      contentType: artifact.type === "document" ? "document" : "file",
      sourceType: "artifact",
      sourceId: input.artifactId,
      source: {
        sourceKind: "artifact",
        provider: "layers",
        externalId: input.artifactId,
        importMode: "artifact",
        metadata: {
          type: artifact.type,
          language: artifact.language,
          framework: artifact.framework,
          version: artifact.current_version,
          previewUrl: artifact.preview_url,
          snapshotId: artifact.snapshot_id,
        },
      },
      stackIds: input.stackIds,
      tags: input.tags,
    });

    if ("error" in result) return result;
    item = result.item;
  }

  await Promise.allSettled([
    addLibrarySource(supabase, {
      orgId: input.orgId,
      itemId: item.id,
      userId: input.userId,
      source: {
        sourceKind: "artifact",
        provider: "layers",
        externalId: input.artifactId,
        importMode: "artifact",
        metadata: {
          type: artifact.type,
          version: artifact.current_version,
          previewUrl: artifact.preview_url,
          snapshotId: artifact.snapshot_id,
          reason: input.reason ?? null,
        },
      },
    }),
    input.stackIds?.length
      ? assignLibraryItemToStacks(supabase, {
          orgId: input.orgId,
          itemId: item.id,
          stackIds: input.stackIds,
          userId: input.userId,
        })
      : Promise.resolve(),
    input.tags?.length ? assignTags(supabase, input.orgId, item.id, input.tags, input.userId) : Promise.resolve(),
  ]);

  if (artifact.preview_url) {
    const asset = await saveLibraryAsset(supabase, input.orgId, input.userId, {
      kind: "artifact_preview",
      title: `${artifact.title} preview`,
      originalUrl: artifact.preview_url,
      metadata: {
        artifactId: input.artifactId,
        snapshotId: artifact.snapshot_id,
        exposePort: artifact.expose_port,
        runCommand: artifact.run_command,
      },
    });
    if ("assetId" in asset) {
      await attachAssetToLibraryItem(supabase, {
        orgId: input.orgId,
        itemId: item.id,
        assetId: asset.assetId,
        role: "preview",
      });
    }
  }

  await writeAudit(supabase, {
    orgId: input.orgId,
    userId: input.userId,
    action: "library.artifact.saved_back",
    resourceType: "artifact",
    resourceId: input.artifactId,
    metadata: { contextItemId: item.id, reason: input.reason ?? null },
  });

  return { item };
}

export async function createContextPack(supabase: AnySupabase, input: ContextPackInput) {
  if (!input.name.trim()) return { error: "Context pack name is required" };

  const { data: pack, error } = await supabase
    .from("context_packs")
    .insert({
      org_id: input.orgId,
      name: input.name.trim(),
      purpose: input.purpose ?? null,
      created_by: input.userId ?? null,
      visibility: input.visibility ?? "private",
      retrieval_query: input.retrievalQuery ?? null,
      instructions: input.instructions ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error || !pack) return { error: error?.message ?? "Failed to create context pack" };

  const itemIds = [...new Set(input.itemIds ?? [])].filter(Boolean);
  if (itemIds.length > 0) {
    await supabase.from("context_pack_items").insert(
      itemIds.map((itemId, index) => ({
        context_pack_id: pack.id,
        context_item_id: itemId,
        sort_order: index,
      })),
    );
  }

  await writeAudit(supabase, {
    orgId: input.orgId,
    userId: input.userId,
    action: "library.context_pack.created",
    resourceType: "context_pack",
    resourceId: pack.id,
    metadata: { itemCount: itemIds.length },
  });

  return { contextPack: pack };
}

export async function listContextPacks(supabase: AnySupabase, orgId: string) {
  const { data, error } = await supabase
    .from("context_packs")
    .select("id, name, purpose, visibility, retrieval_query, instructions, metadata, created_at, updated_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { contextPacks: data ?? [] };
}

export function defaultDeweyProfile(orgId: string): DeweyProfile {
  return {
    orgId,
    name: "Dewey",
    voice: "clear, curious, concise",
    tone: "pragmatic librarian",
    allowedTools: [
      "search_library",
      "get_library_item",
      "add_library_item",
      "list_stacks",
      "create_stack",
      "save_asset",
      "create_context_pack",
      "propose_action",
    ],
    approvalPolicy: "risky_writes_require_approval",
    defaultRetrievalScope: { library_scope: "org", include_archived: false },
    memoryPolicy: { save_useful_chat: true, ask_before_saving_sensitive: true },
    saveBehavior: "suggest_then_save",
    instructions: null,
  };
}

export async function getOrCreateDeweyProfile(supabase: AnySupabase, orgId: string) {
  const { data: existing } = await supabase
    .from("dewey_profiles")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_default", true)
    .maybeSingle();

  if (existing) return { profile: mapDeweyProfile(existing) };

  const profile = defaultDeweyProfile(orgId);
  const { data, error } = await supabase
    .from("dewey_profiles")
    .insert({
      org_id: orgId,
      name: profile.name,
      voice: profile.voice,
      tone: profile.tone,
      allowed_tools: profile.allowedTools,
      approval_policy: profile.approvalPolicy,
      default_retrieval_scope: profile.defaultRetrievalScope,
      memory_policy: profile.memoryPolicy,
      save_behavior: profile.saveBehavior,
      instructions: profile.instructions,
      is_default: true,
    })
    .select("*")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create Dewey profile" };
  return { profile: mapDeweyProfile(data) };
}

export async function updateDeweyProfile(
  supabase: AnySupabase,
  orgId: string,
  patch: Partial<DeweyProfile>,
) {
  const updates: Record<string, unknown> = {};
  if (patch.voice !== undefined) updates.voice = patch.voice;
  if (patch.tone !== undefined) updates.tone = patch.tone;
  if (patch.allowedTools !== undefined) updates.allowed_tools = patch.allowedTools;
  if (patch.approvalPolicy !== undefined) updates.approval_policy = patch.approvalPolicy;
  if (patch.defaultRetrievalScope !== undefined) updates.default_retrieval_scope = patch.defaultRetrievalScope;
  if (patch.memoryPolicy !== undefined) updates.memory_policy = patch.memoryPolicy;
  if (patch.saveBehavior !== undefined) updates.save_behavior = patch.saveBehavior;
  if (patch.instructions !== undefined) updates.instructions = patch.instructions;

  const { data, error } = await supabase
    .from("dewey_profiles")
    .update(updates)
    .eq("org_id", orgId)
    .eq("is_default", true)
    .select("*")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to update Dewey profile" };
  return { profile: mapDeweyProfile(data) };
}

function mapDeweyProfile(row: Record<string, any>): DeweyProfile {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    voice: row.voice,
    tone: row.tone,
    allowedTools: row.allowed_tools ?? [],
    approvalPolicy: row.approval_policy,
    defaultRetrievalScope: row.default_retrieval_scope ?? {},
    memoryPolicy: row.memory_policy ?? {},
    saveBehavior: row.save_behavior ?? "suggest_then_save",
    instructions: row.instructions ?? null,
  };
}

export async function createMcpImportBatch(
  supabase: AnySupabase,
  input: {
    orgId: string;
    userId?: string;
    mcpServerId?: string;
    mode: McpIngestionMode;
    query?: string;
    selectedCount?: number;
    savedCount?: number;
    status?: "pending" | "completed" | "failed" | "cancelled";
    metadata?: Record<string, unknown>;
  },
) {
  const { data, error } = await supabase
    .from("mcp_import_batches")
    .insert({
      org_id: input.orgId,
      mcp_server_id: input.mcpServerId ?? null,
      requested_by: input.userId ?? null,
      mode: input.mode,
      query: input.query ?? null,
      selected_count: input.selectedCount ?? 0,
      saved_count: input.savedCount ?? 0,
      status: input.status ?? "pending",
      metadata: input.metadata ?? {},
      completed_at: input.status === "completed" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create MCP import batch" };
  return { batch: data };
}

export async function createMcpSyncRule(
  supabase: AnySupabase,
  input: {
    orgId: string;
    userId: string;
    mcpServerId: string;
    name: string;
    toolName?: string;
    query?: string;
    selector?: Record<string, unknown>;
    destinationStackId?: string;
    itemType?: string;
    cadence?: string;
    approvalRequired?: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  if (!input.name.trim()) return { error: "Sync rule name is required" };

  const { data, error } = await supabase
    .from("mcp_sync_rules")
    .insert({
      org_id: input.orgId,
      mcp_server_id: input.mcpServerId,
      name: input.name.trim(),
      tool_name: input.toolName ?? null,
      query: input.query ?? null,
      selector: input.selector ?? {},
      destination_collection_id: input.destinationStackId ?? null,
      item_type: input.itemType ?? null,
      cadence: input.cadence ?? null,
      approval_required: input.approvalRequired ?? false,
      created_by: input.userId,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create MCP sync rule" };
  return { syncRule: data };
}

export async function proposeAction(
  supabase: AnySupabase,
  input: {
    orgId: string;
    actionType: string;
    targetService: string;
    payload: Record<string, unknown>;
    reasoning?: string;
    conflictReason?: string;
    requestedByAgent?: string;
  },
) {
  const { data, error } = await supabase
    .from("approval_queue")
    .insert({
      org_id: input.orgId,
      requested_by_agent: input.requestedByAgent ?? "dewey",
      action_type: input.actionType,
      target_service: input.targetService,
      payload: input.payload,
      reasoning: input.reasoning ?? null,
      conflict_reason: input.conflictReason ?? null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to propose action" };
  return { proposal: data };
}

export async function auditExternalCall(
  supabase: AnySupabase,
  input: {
    orgId: string;
    userId?: string;
    actorType?: "human" | "system_agent" | "external_client";
    direction: "inbound" | "outbound";
    toolName?: string;
    targetService?: string;
    requestSummary?: string;
    status?: "ok" | "approval_required" | "denied" | "error";
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("library_external_calls").insert({
    org_id: input.orgId,
    user_id: input.userId ?? null,
    actor_type: input.actorType ?? "system_agent",
    direction: input.direction,
    tool_name: input.toolName ?? null,
    target_service: input.targetService ?? null,
    request_summary: input.requestSummary ?? null,
    status: input.status ?? "ok",
    metadata: input.metadata ?? {},
  });
}

async function getItemStacks(supabase: AnySupabase, itemId: string) {
  const { data } = await supabase
    .from("collection_items")
    .select("collections(id, name, description, icon, color)")
    .eq("context_item_id", itemId);
  return data ?? [];
}

async function getItemTags(supabase: AnySupabase, itemId: string) {
  const { data } = await supabase
    .from("item_tags")
    .select("tags(id, name, color, tag_type)")
    .eq("context_item_id", itemId);
  return data ?? [];
}

async function getItemAssets(supabase: AnySupabase, itemId: string) {
  const { data } = await supabase
    .from("library_item_assets")
    .select("role, sort_order, library_assets(*)")
    .eq("context_item_id", itemId)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

async function getItemSources(supabase: AnySupabase, orgId: string, itemId: string) {
  const { data } = await supabase
    .from("library_sources")
    .select("*")
    .eq("org_id", orgId)
    .eq("context_item_id", itemId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function getItemRelationships(supabase: AnySupabase, orgId: string, itemId: string) {
  const { data } = await supabase
    .from("library_item_relationships")
    .select("*")
    .eq("org_id", orgId)
    .or(`from_context_item_id.eq.${itemId},to_context_item_id.eq.${itemId}`)
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function writeAudit(
  supabase: AnySupabase,
  input: {
    orgId: string;
    userId?: string;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("audit_log").insert({
    org_id: input.orgId,
    user_id: input.userId ?? null,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    metadata: input.metadata ?? {},
  });
}
