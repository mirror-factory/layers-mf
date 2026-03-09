import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiGrid } from "./kpi-card";
import {
  computeContextHealthKpis,
  computeSourceKpis,
  type ContextHealthData,
  type IntegrationHealthItem,
} from "@/lib/kpi/compute";

interface Props {
  data: ContextHealthData;
  integrations: IntegrationHealthItem[];
}

export function ContextHealthPanel({ data, integrations }: Props) {
  const kpis = computeContextHealthKpis(data);
  const sourceKpis = computeSourceKpis(data.by_source);

  return (
    <div className="space-y-6">
      {/* Pipeline KPIs */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Pipeline Health
        </h3>
        <KpiGrid kpis={kpis} />
      </div>

      {/* Pipeline counts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Pipeline Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">
                {data.pipeline.ready}
              </p>
              <p className="text-xs text-muted-foreground">Ready</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {data.pipeline.error}
              </p>
              <p className="text-xs text-muted-foreground">Error</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">
                {data.pipeline.pending}
              </p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {data.pipeline.processing}
              </p>
              <p className="text-xs text-muted-foreground">Processing</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-source health */}
      {sourceKpis.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Per-Source Health
          </h3>
          <KpiGrid kpis={sourceKpis} />
        </div>
      )}

      {/* Integrations */}
      {integrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Integration Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {integrations.map((ig) => (
                <div
                  key={ig.provider}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {ig.provider}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ig.item_count} items
                      {ig.error_count > 0 &&
                        ` · ${ig.error_count} errors`}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        ig.status === "active"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : ig.status === "error"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                      }`}
                    >
                      {ig.status}
                    </span>
                    {ig.hours_since_sync != null && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        synced {ig.hours_since_sync.toFixed(1)}h ago
                      </p>
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
