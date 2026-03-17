import { SourceTrustSettings } from "@/components/source-trust-settings";

export default function SourceTrustPage() {
  return (
    <div className="p-8 max-w-2xl" data-testid="source-trust-page">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1">Source Trust</h1>
        <p className="text-muted-foreground text-sm">
          Control how much each source influences search results and AI answers.
          Higher weight means more prominence in results.
        </p>
      </div>
      <SourceTrustSettings />
    </div>
  );
}
