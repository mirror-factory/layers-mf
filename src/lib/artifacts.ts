/**
 * Universal Artifact System — Core Operations
 *
 * All artifact creation, versioning, and file persistence goes through here.
 * Tools (write_code, create_document, run_project) call these functions
 * instead of writing to context_items directly.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export interface CreateArtifactInput {
  orgId: string;
  userId?: string;
  type: "code" | "document" | "sandbox" | "csv" | "image" | "html";
  title: string;
  content?: string;
  language?: string;
  framework?: string;
  description?: string;
  tags?: string[];
  // For multi-file projects
  files?: { path: string; content: string }[];
  primaryFilePath?: string;
  // For sandbox
  snapshotId?: string;
  previewUrl?: string;
  runCommand?: string;
  exposePort?: number;
  // For conversation linking
  conversationId?: string;
  // Cost tracking
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  modelUsed?: string;
}

export interface CreateVersionInput {
  artifactId: string;
  content?: string;
  files?: { path: string; content: string }[];
  snapshotId?: string;
  changeSummary?: string;
  changeType: "create" | "edit" | "ai_edit" | "manual_edit" | "fork" | "restore";
  createdBy?: string;
  createdByAi?: boolean;
  modelUsed?: string;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Create a new artifact with its first version.
 * Returns the artifact ID and version number.
 */
export async function createArtifact(
  supabase: AnySupabase,
  input: CreateArtifactInput,
): Promise<{ artifactId: string; versionNumber: number } | { error: string }> {
  try {
    // 1. Create the artifact record
    const { data: artifact, error: artifactErr } = await supabase
      .from("artifacts")
      .insert({
        org_id: input.orgId,
        user_id: input.userId ?? null,
        type: input.type,
        title: input.title,
        content: input.content ?? null,
        language: input.language ?? null,
        framework: input.framework ?? null,
        current_version: 1,
        primary_file_path: input.primaryFilePath ?? null,
        description_oneliner: input.description?.slice(0, 80) ?? null,
        description_short: input.description ?? null,
        tags: input.tags ?? [],
        snapshot_id: input.snapshotId ?? null,
        preview_url: input.previewUrl ?? null,
        run_command: input.runCommand ?? null,
        expose_port: input.exposePort ?? null,
        conversation_id: input.conversationId ?? null,
        total_cost_usd: input.costUsd ?? 0,
        total_input_tokens: input.inputTokens ?? 0,
        total_output_tokens: input.outputTokens ?? 0,
        status: "active",
      })
      .select("id")
      .single();

    if (artifactErr || !artifact) {
      return { error: `Failed to create artifact: ${artifactErr?.message ?? "unknown"}` };
    }

    const artifactId = artifact.id;

    // 2. Create version 1
    const { error: versionErr } = await supabase
      .from("artifact_versions")
      .insert({
        artifact_id: artifactId,
        version_number: 1,
        content: input.content ?? (input.files ? input.files.map(f => `// === ${f.path} ===\n${f.content}`).join("\n\n") : null),
        snapshot_id: input.snapshotId ?? null,
        change_summary: "Created",
        change_type: "create",
        created_by: input.userId ?? null,
        created_by_ai: true,
        model_used: input.modelUsed ?? null,
        cost_usd: input.costUsd ?? 0,
        input_tokens: input.inputTokens ?? 0,
        output_tokens: input.outputTokens ?? 0,
      });

    if (versionErr) {
      console.error("[artifacts] Failed to create version:", versionErr.message);
    }

    // 3. Save individual files (for multi-file projects)
    if (input.files && input.files.length > 0) {
      const fileRows = input.files.map(f => ({
        artifact_id: artifactId,
        version_number: 1,
        file_path: f.path,
        content: f.content,
        language: detectLanguage(f.path),
        size_bytes: new TextEncoder().encode(f.content).length,
      }));

      const { error: filesErr } = await supabase
        .from("artifact_files")
        .insert(fileRows);

      if (filesErr) {
        console.error("[artifacts] Failed to save files:", filesErr.message);
      }
    }

    // 4. Also save to context_items for search indexing
    // (artifacts are searchable through the existing hybrid search)
    await supabase
      .from("context_items")
      .insert({
        org_id: input.orgId,
        source_type: input.type === "sandbox" ? "code" : input.type,
        source_id: `artifact-${artifactId}`,
        content_type: input.type === "document" ? "document" : "file",
        title: input.title,
        raw_content: input.content ?? input.files?.map(f => `// ${f.path}\n${f.content}`).join("\n\n").slice(0, 50000),
        description_short: input.description ?? `${input.type}: ${input.title}`,
        status: "ready",
      })
      .then(() => {}) // fire and forget
      .catch(() => {}); // don't fail if indexing fails

    return { artifactId, versionNumber: 1 };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Create a new version of an existing artifact.
 */
export async function createVersion(
  supabase: AnySupabase,
  input: CreateVersionInput,
): Promise<{ versionNumber: number } | { error: string }> {
  try {
    // Get current version
    const { data: artifact } = await supabase
      .from("artifacts")
      .select("current_version, total_cost_usd, total_input_tokens, total_output_tokens")
      .eq("id", input.artifactId)
      .single();

    if (!artifact) return { error: "Artifact not found" };

    const newVersion = (artifact.current_version ?? 0) + 1;

    // 1. Create version record
    const { error: versionErr } = await supabase
      .from("artifact_versions")
      .insert({
        artifact_id: input.artifactId,
        version_number: newVersion,
        content: input.content ?? null,
        snapshot_id: input.snapshotId ?? null,
        change_summary: input.changeSummary ?? null,
        change_type: input.changeType,
        created_by: input.createdBy ?? null,
        created_by_ai: input.createdByAi ?? false,
        model_used: input.modelUsed ?? null,
        cost_usd: input.costUsd ?? 0,
        input_tokens: input.inputTokens ?? 0,
        output_tokens: input.outputTokens ?? 0,
      });

    if (versionErr) return { error: `Version creation failed: ${versionErr.message}` };

    // 2. Save files if provided
    if (input.files && input.files.length > 0) {
      const fileRows = input.files.map(f => ({
        artifact_id: input.artifactId,
        version_number: newVersion,
        file_path: f.path,
        content: f.content,
        language: detectLanguage(f.path),
        size_bytes: new TextEncoder().encode(f.content).length,
      }));

      await supabase.from("artifact_files").insert(fileRows);
    }

    // 3. Update artifact record
    await supabase
      .from("artifacts")
      .update({
        current_version: newVersion,
        content: input.content ?? undefined,
        snapshot_id: input.snapshotId ?? undefined,
        total_cost_usd: (artifact.total_cost_usd ?? 0) + (input.costUsd ?? 0),
        total_input_tokens: (artifact.total_input_tokens ?? 0) + (input.inputTokens ?? 0),
        total_output_tokens: (artifact.total_output_tokens ?? 0) + (input.outputTokens ?? 0),
      })
      .eq("id", input.artifactId);

    return { versionNumber: newVersion };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Get artifact files for a specific version.
 * If version is null, gets the latest version's files.
 */
export async function getArtifactFiles(
  supabase: AnySupabase,
  artifactId: string,
  versionNumber?: number,
): Promise<{ path: string; content: string; language?: string }[]> {
  let query = supabase
    .from("artifact_files")
    .select("file_path, content, language")
    .eq("artifact_id", artifactId);

  if (versionNumber) {
    query = query.eq("version_number", versionNumber);
  } else {
    // Get latest version files
    const { data: artifact } = await supabase
      .from("artifacts")
      .select("current_version")
      .eq("id", artifactId)
      .single();
    if (artifact) {
      query = query.eq("version_number", artifact.current_version);
    }
  }

  const { data } = await query;
  return (data ?? []).map((f: { file_path: string; content: string; language?: string }) => ({
    path: f.file_path,
    content: f.content,
    language: f.language,
  }));
}

/** Detect language from file extension */
function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
    css: "css", html: "html", json: "json", yaml: "yaml", yml: "yaml",
    sh: "bash", sql: "sql", md: "markdown", txt: "text",
  };
  return map[ext] ?? ext;
}
