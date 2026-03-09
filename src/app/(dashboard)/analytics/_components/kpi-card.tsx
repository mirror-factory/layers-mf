import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { KpiResult } from "@/lib/kpi/compute";

const STATUS_STYLES = {
  pass: "border-l-green-500",
  warn: "border-l-yellow-500",
  fail: "border-l-red-500",
} as const;

const STATUS_DOTS = {
  pass: "bg-green-500",
  warn: "bg-yellow-500",
  fail: "bg-red-500",
} as const;

function formatValue(value: number, unit: string): string {
  if (unit === "%") return `${(value * 100).toFixed(1)}%`;
  if (unit === "ms") return `${(value / 1000).toFixed(1)}s`;
  if (unit === "hours") return `${value.toFixed(1)}h`;
  return value.toFixed(1);
}

function formatTarget(target: number, unit: string): string {
  if (unit === "%") return `${(target * 100).toFixed(0)}%`;
  if (unit === "ms") return `${(target / 1000).toFixed(0)}s`;
  if (unit === "hours") return `${target}h`;
  return String(target);
}

export function KpiCard({ kpi }: { kpi: KpiResult }) {
  return (
    <Card className={`border-l-4 ${STATUS_STYLES[kpi.status]}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {kpi.name}
        </CardTitle>
        <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOTS[kpi.status]}`} />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{formatValue(kpi.value, kpi.unit)}</p>
        {kpi.target > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Target: {formatTarget(kpi.target, kpi.unit)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function KpiGrid({ kpis }: { kpis: KpiResult[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.name} kpi={kpi} />
      ))}
    </div>
  );
}
