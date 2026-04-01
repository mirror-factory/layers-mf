export const metadata = { title: "Source Trust" };

import { SourceTrustSettings } from "@/components/source-trust-settings";
import { PageExplainer } from "@/components/page-explainer";

export default function SourceTrustPage() {
  return (
    <div className="p-4 sm:p-8 max-w-2xl" data-testid="source-trust-page">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">Source Trust</h1>
        <p className="text-muted-foreground text-sm">
          Control how much each source influences search results and AI answers.
          Higher weight means more prominence in results.
        </p>
      </div>
      <PageExplainer
        title="How Source Trust Works"
        sections={[
          { title: "Weight Sources", content: "Assign a trust weight to each connected source. Higher weights boost that source in search results and AI answers." },
          { title: "Priority Scoring", content: "When multiple sources mention the same topic, trust weights determine which answer the AI favors." },
          { title: "Defaults", content: "All sources start at equal weight. Adjust as you learn which sources are most reliable for your team." },
        ]}
      />
      <SourceTrustSettings />
    </div>
  );
}
