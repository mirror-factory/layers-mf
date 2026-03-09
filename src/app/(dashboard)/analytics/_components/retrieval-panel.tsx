import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContextHealthData } from "@/lib/kpi/compute";

interface Props {
  data: ContextHealthData;
}

export function RetrievalPanel({ data }: Props) {
  const { extraction_quality: eq } = data;
  const readyCount = eq.ready_count || 1; // avoid divide-by-zero

  const metrics = [
    { label: "Has Entities", count: eq.has_entities, rate: eq.has_entities / readyCount },
    { label: "Has Topics", count: eq.has_topics, rate: eq.has_topics / readyCount },
    { label: "Has Action Items", count: eq.has_action_items, rate: eq.has_action_items / readyCount },
    { label: "Has People", count: eq.has_people, rate: eq.has_people / readyCount },
    { label: "Has Decisions", count: eq.has_decisions, rate: eq.has_decisions / readyCount },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Retrieval Quality Indicators
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          These metrics track how well context items are prepared for retrieval.
          Run <code className="text-xs bg-muted px-1 py-0.5 rounded">pnpm eval:retrieval</code> for
          live Precision@5 and MRR scores.
        </p>
      </div>

      {/* Embedding coverage bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Embedding Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${(data.embedding_coverage * 100).toFixed(1)}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-bold">
              {(data.embedding_coverage * 100).toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ready items with vector embeddings for semantic search
          </p>
        </CardContent>
      </Card>

      {/* Content completeness */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Content Completeness</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(data.content_completeness * 100).toFixed(1)}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-bold">
              {(data.content_completeness * 100).toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ready items with all fields populated (title, short/long descriptions, raw content)
          </p>
        </CardContent>
      </Card>

      {/* Entity extraction breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Entity Extraction ({eq.ready_count} ready items)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{m.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.count} ({(m.rate * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full"
                    style={{ width: `${(m.rate * 100).toFixed(1)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Source breakdown */}
      {data.by_source.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Items by Source</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {data.by_source.map((s) => (
                <div
                  key={s.source_type}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <span className="text-sm font-medium capitalize">
                    {s.source_type}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {s.ready}/{s.total} ready
                    </span>
                    {s.error_count > 0 && (
                      <span className="text-[10px] text-destructive font-medium">
                        {s.error_count} errors
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
