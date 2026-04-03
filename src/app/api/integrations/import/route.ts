import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { nango } from "@/lib/nango/client";
import { extractStructured } from "@/lib/ai/extract";
import { generateEmbedding } from "@/lib/ai/embed";
import { computeContentHash } from "@/lib/versioning";
import { createInboxItems } from "@/lib/inbox";
import { checkCredits, deductCredits, CREDIT_COSTS } from "@/lib/credits";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { randomUUID } from "crypto";

// ── In-memory job tracker ───────────────────────────────────────────────────
export interface ImportJob {
  jobId: string;
  total: number;
  completed: number;
  failed: number;
  status: "running" | "complete" | "error";
  error?: string;
}

// Module-level map — persists for the lifetime of the serverless function
const importJobs = new Map<string, ImportJob>();

export function getImportJob(jobId: string): ImportJob | undefined {
  return importJobs.get(jobId);
}

// ── Google Drive MIME type helpers (mirrored from sync route) ────────────────
const GDRIVE_EXPORTABLE: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

const GDRIVE_DOWNLOADABLE = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

async function fetchFileContent(
  fileId: string,
  mimeType: string,
  connectionId: string
): Promise<string | null> {
  const exportMime = GDRIVE_EXPORTABLE[mimeType];
  const isDownloadable = GDRIVE_DOWNLOADABLE.has(mimeType);

  if (!exportMime && !isDownloadable) return null;

  if (exportMime) {
    const res = await nango.proxy<string>({
      method: "GET",
      providerConfigKey: "google-drive",
      connectionId,
      endpoint: `/drive/v3/files/${fileId}/export`,
      params: { mimeType: exportMime },
    });
    return typeof res.data === "string" ? res.data.trim() : null;
  }

  // Download binary file
  const res = await nango.proxy<ArrayBuffer>({
    method: "GET",
    providerConfigKey: "google-drive",
    connectionId,
    endpoint: `/drive/v3/files/${fileId}`,
    params: { alt: "media" },
    responseType: "arraybuffer",
  });

  const buffer = Buffer.from(res.data);

  switch (mimeType) {
    case "application/pdf": {
      const parsed = await pdfParse(buffer);
      return parsed.text.trim();
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const parsed = await mammoth.extractRawText({ buffer });
      return parsed.value.trim();
    }
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (sheetName) {
        return XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]).trim();
      }
      return null;
    }
    case "text/plain":
    case "text/markdown":
    case "text/csv":
      return buffer.toString("utf-8").trim();
    default:
      return null;
  }
}

function detectContentType(mimeType: string): string {
  if (
    mimeType.includes("spreadsheet") ||
    mimeType === "text/csv" ||
    mimeType.includes("spreadsheetml")
  )
    return "spreadsheet";
  if (mimeType.includes("presentation")) return "presentation";
  return "document";
}

// ── POST handler ────────────────────────────────────────────────────────────
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let fileIds: string[];
  let connectionId: string;
  try {
    const body = await request.json();
    fileIds = body.fileIds;
    connectionId = body.connectionId;
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      throw new Error("fileIds required");
    }
    if (!connectionId) throw new Error("connectionId required");
  } catch {
    return NextResponse.json(
      { error: "fileIds (array) and connectionId required" },
      { status: 400 }
    );
  }

  // Verify the integration belongs to the user's org
  const { data: integration } = await supabase
    .from("integrations")
    .select("org_id")
    .eq("nango_connection_id", connectionId)
    .single();

  if (!integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  const orgId = integration.org_id;
  const jobId = randomUUID();

  const job: ImportJob = {
    jobId,
    total: fileIds.length,
    completed: 0,
    failed: 0,
    status: "running",
  };
  importJobs.set(jobId, job);

  // Process files asynchronously — do not await
  processFilesInBackground(
    jobId,
    fileIds,
    connectionId,
    orgId
  ).catch((err) => {
    const j = importJobs.get(jobId);
    if (j) {
      j.status = "error";
      j.error = err instanceof Error ? err.message : String(err);
    }
  });

  return NextResponse.json({ jobId, total: fileIds.length });
}

async function processFilesInBackground(
  jobId: string,
  fileIds: string[],
  connectionId: string,
  orgId: string
) {
  const adminDb = createAdminClient();
  const job = importJobs.get(jobId)!;

  for (const fileId of fileIds) {
    try {
      // Fetch file metadata
      const metaRes = await nango.proxy<{
        id: string;
        name: string;
        mimeType: string;
        size?: string;
        createdTime?: string;
        modifiedTime?: string;
        webViewLink?: string;
      }>({
        method: "GET",
        providerConfigKey: "google-drive",
        connectionId,
        endpoint: `/drive/v3/files/${fileId}`,
        params: {
          fields: "id,name,mimeType,size,createdTime,modifiedTime,webViewLink",
        },
      });

      const file = metaRes.data;
      if (!file?.name) {
        job.failed++;
        job.completed++;
        continue;
      }

      // Skip folders
      if (file.mimeType === "application/vnd.google-apps.folder") {
        job.completed++;
        continue;
      }

      // Check if already exists
      const { data: existing } = await adminDb
        .from("context_items")
        .select("id")
        .eq("org_id", orgId)
        .eq("source_type", "google-drive")
        .eq("source_id", file.id)
        .maybeSingle();

      if (existing) {
        // Already imported — skip
        job.completed++;
        continue;
      }

      // Fetch content
      const content = await fetchFileContent(
        file.id,
        file.mimeType,
        connectionId
      );

      if (!content || content.length < 30) {
        job.failed++;
        job.completed++;
        continue;
      }

      const contentType = detectContentType(file.mimeType);
      const truncatedContent = content.slice(0, 12000);

      // Insert context_item with status='processing'
      const { data: inserted, error: insertError } = await adminDb
        .from("context_items")
        .insert({
          org_id: orgId,
          source_type: "google-drive",
          source_id: file.id,
          nango_connection_id: connectionId,
          title: file.name,
          raw_content: truncatedContent,
          content_type: contentType,
          content_hash: computeContentHash(truncatedContent),
          status: "processing",
          source_created_at: file.createdTime ?? null,
          source_metadata: {
            url: file.webViewLink ?? null,
            mimeType: file.mimeType,
            fileSize: file.size ?? null,
            modifiedTime: file.modifiedTime ?? null,
          },
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        job.failed++;
        job.completed++;
        continue;
      }

      // Run AI extraction + embedding
      try {
        const creditCostPerItem = CREDIT_COSTS.extraction + CREDIT_COSTS.embedding;
        const creditCheck = await checkCredits(orgId, creditCostPerItem);
        if (!creditCheck.sufficient) {
          // Mark as pending — cron will pick it up later
          await adminDb
            .from("context_items")
            .update({ status: "pending" })
            .eq("id", inserted.id);
          job.completed++;
          continue;
        }

        const [extraction, embedding] = await Promise.all([
          extractStructured(truncatedContent, file.name),
          generateEmbedding(truncatedContent),
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
          .eq("id", inserted.id);

        await deductCredits(orgId, creditCostPerItem, "import:google-drive");
        await createInboxItems(adminDb, orgId, inserted.id, extraction, "google-drive");
      } catch {
        // AI processing failed — leave in 'processing' status for cron to retry
        await adminDb
          .from("context_items")
          .update({ status: "pending" })
          .eq("id", inserted.id);
      }

      job.completed++;
    } catch {
      job.failed++;
      job.completed++;
    }
  }

  job.status = job.failed === job.total ? "error" : "complete";

  // Clean up the job after 10 minutes to prevent memory leaks
  setTimeout(() => {
    importJobs.delete(jobId);
  }, 10 * 60 * 1000);
}
