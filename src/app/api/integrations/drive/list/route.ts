import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nango } from "@/lib/nango/client";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  modifiedTime: string | null;
  iconLink: string | null;
  isFolder: boolean;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId") || "root";
  const connectionId = searchParams.get("connectionId");

  if (!connectionId) {
    return NextResponse.json(
      { error: "connectionId is required" },
      { status: 400 }
    );
  }

  // Verify the integration belongs to the user's org (RLS scoped)
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

  try {
    const res = await nango.proxy<{
      files: {
        id: string;
        name: string;
        mimeType: string;
        size?: string;
        modifiedTime?: string;
        iconLink?: string;
      }[];
    }>({
      method: "GET",
      providerConfigKey: "google-drive",
      connectionId,
      endpoint: "/drive/v3/files",
      params: {
        q: `'${folderId}' in parents and trashed = false`,
        fields:
          "files(id,name,mimeType,size,modifiedTime,iconLink)",
        pageSize: "100",
        orderBy: "folder,name",
      },
    });

    const files: DriveFile[] = (res.data?.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size ?? null,
      modifiedTime: f.modifiedTime ?? null,
      iconLink: f.iconLink ?? null,
      isFolder: f.mimeType === "application/vnd.google-apps.folder",
    }));

    // Sort: folders first, then files alphabetically
    files.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ files });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[drive/list] Error:", message);
    return NextResponse.json(
      { error: "Failed to list Drive files" },
      { status: 500 }
    );
  }
}
