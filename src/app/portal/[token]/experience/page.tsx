"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { PortalData } from "@/app/portal/[token]/page";
import { PortalExperience } from "@/components/portal-experience";

export default function ExperiencePage() {
  const params = useParams<{ token: string }>();
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPortal = async () => {
      try {
        const res = await fetch(`/api/portals/public/${params.token}`);
        if (!res.ok) {
          setError(res.status === 404 ? "Portal not found." : "Failed to load portal.");
          return;
        }
        const data = await res.json();
        const p = data.portal ?? data;
        p.documents = p.documents ?? [];
        p.enabled_tools = p.enabled_tools ?? [];
        setPortal(p);
      } catch {
        setError("Failed to load portal.");
      } finally {
        setLoading(false);
      }
    };

    if (params.token) fetchPortal();
  }, [params.token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050508]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="text-sm text-white/40">Loading experience...</p>
        </div>
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050508]">
        <p className="text-sm text-red-400">{error ?? "Could not load portal."}</p>
      </div>
    );
  }

  return <PortalExperience portal={portal} />;
}
