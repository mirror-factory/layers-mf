"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PortalViewer } from "@/components/portal-viewer";
import { Loader2 } from "lucide-react";

export interface PortalDocument {
  id: string;
  title: string;
  context_item_id: string;
  is_active: boolean;
  pdf_path?: string;
}

export interface PortalData {
  id: string;
  title: string;
  subtitle: string | null;
  client_name: string | null;
  brand_color: string;
  brand_secondary_color: string | null;
  logo_url: string | null;
  pdf_url: string | null;
  pdf_storage_path: string | null;
  document_content: string | null;
  documents: PortalDocument[];
  audio_url: string | null;
  audio_storage_path: string | null;
  system_prompt: string | null;
  enabled_tools: string[];
  model: string;
  hide_chrome: boolean;
  default_expanded: boolean;
  share_token: string;
  page_count: number | null;
}

export default function PortalPage() {
  const params = useParams<{ token: string }>();
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPortal = async () => {
      try {
        const res = await fetch(`/api/portals/public/${params.token}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Portal not found or has been deactivated.");
          } else {
            setError("Failed to load portal.");
          }
          return;
        }
        const data = await res.json();
        const p = data.portal ?? data;
        // Map storage paths to URLs
        p.pdf_url = p.pdf_url || p.pdf_storage_path || null;
        p.audio_url = p.audio_url || p.audio_storage_path || null;
        p.documents = p.documents ?? [];
        p.enabled_tools = p.enabled_tools ?? [];
        setPortal(p);
      } catch {
        setError("Failed to load portal.");
      } finally {
        setLoading(false);
      }
    };

    if (params.token) {
      fetchPortal();
    }
  }, [params.token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="text-sm text-muted-foreground">Loading portal...</p>
        </div>
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-red-500/10 p-4">
            <span className="text-2xl">!</span>
          </div>
          <h1 className="text-xl font-semibold">Portal Unavailable</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {error ?? "This portal could not be loaded."}
          </p>
        </div>
      </div>
    );
  }

  return <PortalViewer portal={portal} />;
}
