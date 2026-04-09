"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PortalViewer } from "@/components/portal-viewer";
import { PortalSplash } from "@/components/portal-splash";

export interface PortalDocument {
  id: string;
  title: string;
  context_item_id: string;
  is_active: boolean;
  pdf_path?: string;
  content?: string | null;
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

  useEffect(() => {
    const fetchPortal = async () => {
      try {
        const res = await fetch(`/api/portals/public/${params.token}`);
        if (!res.ok) {
          setError(res.status === 404 ? "Portal not found or has been deactivated." : "Failed to load portal.");
          return;
        }
        const data = await res.json();
        const p = data.portal ?? data;
        p.documents = p.documents ?? [];
        p.enabled_tools = p.enabled_tools ?? [];
        setPortal(p);
      } catch {
        setError("Failed to load portal.");
      }
    };
    if (params.token) fetchPortal();
  }, [params.token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-red-500/10 p-4">
            <span className="text-2xl">!</span>
          </div>
          <h1 className="text-xl font-semibold">Portal Unavailable</h1>
          <p className="max-w-md text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  // Splash stays visible until portal data is loaded
  return (
    <PortalSplash
      loaded={!!portal}
      logoUrl={portal?.logo_url ?? undefined}
      clientName={portal?.client_name ?? undefined}
      brandColor={portal?.brand_color}
    >
      {portal && <PortalViewer portal={portal} />}
    </PortalSplash>
  );
}
