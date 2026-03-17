import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ContentHealthDashboard } from "@/components/content-health-dashboard";

export default function ContentHealthPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-5xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Analytics
          </Link>
          <h1 className="text-xl sm:text-2xl font-semibold">Content Health</h1>
          <p className="text-muted-foreground text-sm">
            Freshness metrics and staleness tracking for your content library.
          </p>
        </div>
      </div>

      <ContentHealthDashboard />
    </div>
  );
}
