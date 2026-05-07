"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PortalAnalyticsDashboard } from "@/components/portal-analytics-dashboard";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PortalMeta {
  id: string;
  title: string;
  client_name: string | null;
  brand_color: string;
}

export default function PortalAnalyticsPage() {
  const params = useParams<{ token: string }>();
  const [portal, setPortal] = useState<PortalMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/portals/public/${params.token}`);
        if (!res.ok) {
          setError("Portal not found");
          return;
        }
        const data = await res.json();
        const p = data.portal ?? data;
        setPortal({
          id: p.id,
          title: p.title,
          client_name: p.client_name,
          brand_color: p.brand_color,
        });
      } catch {
        setError("Failed to load portal.");
      }
    })();
  }, [params.token]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <Link
            href={`/portal/${params.token}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to portal
          </Link>
        </div>

        {error ? (
          <div className="text-center py-12">
            <p className="text-destructive">{error}</p>
          </div>
        ) : !portal ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : (
          <PortalAnalyticsDashboard
            portalId={portal.id}
            portalTitle={portal.title}
          />
        )}
      </div>
    </div>
  );
}
