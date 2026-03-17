"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  Users,
  Database,
  Coins,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────

interface ModelPricing {
  [model: string]: { input_per_mtok: number; output_per_mtok: number };
}

interface OperationConfig {
  base_credits: number;
  per_1k_tokens: number;
}

interface CreditConfig {
  usd_per_credit: number;
  profit_margin_pct: number;
  operations: Record<string, OperationConfig>;
}

interface CreditPackage {
  credits: number;
  price_usd: number;
  stripe_price_id: string | null;
}

interface PlatformStats {
  totalOrgs: number;
  totalUsers: number;
  totalContextItems: number;
  totalCreditsUsed: number;
  totalRevenue: number;
  usage: {
    today: PeriodStats;
    thisWeek: PeriodStats;
    thisMonth: PeriodStats;
  };
  byModel: Array<{
    model: string;
    operations: number;
    tokens: number;
    cost_usd: number;
  }>;
  profitMargin: {
    cost_usd: number;
    revenue_usd: number;
    margin_pct: number;
    profit_usd: number;
  };
}

interface PeriodStats {
  operations: number;
  tokens: number;
  cost_usd: number;
  credits: number;
}

// ─── Component ───────────────────────────────────────────────────────

export function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [modelPricing, setModelPricing] = useState<ModelPricing>({});
  const [creditConfig, setCreditConfig] = useState<CreditConfig>({
    usd_per_credit: 0.1,
    profit_margin_pct: 40,
    operations: {},
  });
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Fetch config on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/config");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      if (data.model_pricing) setModelPricing(data.model_pricing);
      if (data.credit_config) setCreditConfig(data.credit_config);
      if (data.credit_packages) setCreditPackages(data.credit_packages);
    } catch {
      // Config not seeded yet — use defaults
    } finally {
      setLoading(false);
    }
  }

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed");
      setStats(await res.json());
    } catch {
      // ignore
    } finally {
      setStatsLoading(false);
    }
  }, []);

  async function saveConfig(key: string, value: unknown) {
    setSaving(key);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error("Save failed");
    } catch {
      // Could add toast here
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="pricing" className="space-y-6">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="pricing">Model Pricing</TabsTrigger>
        <TabsTrigger value="credits">Credits</TabsTrigger>
        <TabsTrigger value="packages">Packages</TabsTrigger>
        <TabsTrigger value="stats" onClick={fetchStats}>
          Stats
        </TabsTrigger>
      </TabsList>

      {/* ── Tab 1: Model Pricing ── */}
      <TabsContent value="pricing" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Model Pricing</CardTitle>
            <CardDescription>
              Cost per million tokens for each model (from provider invoices).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Model</th>
                    <th className="pb-2 pr-4 font-medium">
                      Input ($/MTok)
                    </th>
                    <th className="pb-2 font-medium">Output ($/MTok)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.entries(modelPricing).map(([model, prices]) => (
                    <tr key={model}>
                      <td className="py-2 pr-4">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {model}
                        </code>
                      </td>
                      <td className="py-2 pr-4">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-28 h-8 text-sm"
                          value={prices.input_per_mtok}
                          onChange={(e) =>
                            setModelPricing((prev) => ({
                              ...prev,
                              [model]: {
                                ...prev[model],
                                input_per_mtok: parseFloat(e.target.value) || 0,
                              },
                            }))
                          }
                        />
                      </td>
                      <td className="py-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-28 h-8 text-sm"
                          value={prices.output_per_mtok}
                          onChange={(e) =>
                            setModelPricing((prev) => ({
                              ...prev,
                              [model]: {
                                ...prev[model],
                                output_per_mtok:
                                  parseFloat(e.target.value) || 0,
                              },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => saveConfig("model_pricing", modelPricing)}
                disabled={saving === "model_pricing"}
                size="sm"
              >
                {saving === "model_pricing" ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save Pricing
              </Button>
              <Button variant="outline" size="sm" disabled>
                <RefreshCw className="h-4 w-4 mr-1" />
                Fetch from AI Gateway
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Tab 2: Credit Configuration ── */}
      <TabsContent value="credits" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Credit Configuration</CardTitle>
            <CardDescription>
              Set the exchange rate and profit margin for credits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* USD per credit */}
            <div className="space-y-2">
              <Label>USD per Credit</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                className="w-40"
                value={creditConfig.usd_per_credit}
                onChange={(e) =>
                  setCreditConfig((prev) => ({
                    ...prev,
                    usd_per_credit: parseFloat(e.target.value) || 0.1,
                  }))
                }
              />
            </div>

            {/* Profit margin slider */}
            <div className="space-y-2">
              <Label>
                Profit Margin:{" "}
                <span className="font-bold">
                  {creditConfig.profit_margin_pct}%
                </span>
              </Label>
              <Slider
                value={[creditConfig.profit_margin_pct]}
                onValueChange={([v]) =>
                  setCreditConfig((prev) => ({
                    ...prev,
                    profit_margin_pct: v,
                  }))
                }
                min={0}
                max={100}
                step={1}
                className="w-80"
              />
              <p className="text-xs text-muted-foreground">
                At {creditConfig.profit_margin_pct}% margin, 1 credit = $
                {creditConfig.usd_per_credit.toFixed(2)} to user, $
                {(
                  creditConfig.usd_per_credit *
                  (1 - creditConfig.profit_margin_pct / 100)
                ).toFixed(3)}{" "}
                cost to us, $
                {(
                  creditConfig.usd_per_credit *
                  (creditConfig.profit_margin_pct / 100)
                ).toFixed(3)}{" "}
                profit
              </p>
            </div>

            <Separator />

            {/* Per-operation costs */}
            <div className="space-y-3">
              <Label>Per-Operation Credit Costs</Label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Operation</th>
                      <th className="pb-2 pr-4 font-medium">Base Credits</th>
                      <th className="pb-2 font-medium">Per 1K Tokens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {Object.entries(creditConfig.operations ?? {}).map(
                      ([op, config]) => (
                        <tr key={op}>
                          <td className="py-2 pr-4">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {op}
                            </code>
                          </td>
                          <td className="py-2 pr-4">
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              className="w-24 h-8 text-sm"
                              value={config.base_credits}
                              onChange={(e) =>
                                setCreditConfig((prev) => ({
                                  ...prev,
                                  operations: {
                                    ...prev.operations,
                                    [op]: {
                                      ...prev.operations[op],
                                      base_credits:
                                        parseFloat(e.target.value) || 0,
                                    },
                                  },
                                }))
                              }
                            />
                          </td>
                          <td className="py-2">
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              className="w-24 h-8 text-sm"
                              value={config.per_1k_tokens}
                              onChange={(e) =>
                                setCreditConfig((prev) => ({
                                  ...prev,
                                  operations: {
                                    ...prev.operations,
                                    [op]: {
                                      ...prev.operations[op],
                                      per_1k_tokens:
                                        parseFloat(e.target.value) || 0,
                                    },
                                  },
                                }))
                              }
                            />
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <Button
              onClick={() => saveConfig("credit_config", creditConfig)}
              disabled={saving === "credit_config"}
              size="sm"
            >
              {saving === "credit_config" ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save Credit Config
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Tab 3: Credit Packages ── */}
      <TabsContent value="packages" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Credit Packages</CardTitle>
            <CardDescription>
              Configure purchasable credit packages and their Stripe price IDs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {creditPackages.map((pkg, i) => (
              <div
                key={i}
                className="flex items-end gap-3 p-3 rounded-md border"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Credits</Label>
                  <Input
                    type="number"
                    min="1"
                    className="w-28 h-8 text-sm"
                    value={pkg.credits}
                    onChange={(e) =>
                      setCreditPackages((prev) =>
                        prev.map((p, j) =>
                          j === i
                            ? { ...p, credits: parseInt(e.target.value) || 0 }
                            : p
                        )
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-28 h-8 text-sm"
                    value={pkg.price_usd}
                    onChange={(e) =>
                      setCreditPackages((prev) =>
                        prev.map((p, j) =>
                          j === i
                            ? {
                                ...p,
                                price_usd: parseFloat(e.target.value) || 0,
                              }
                            : p
                        )
                      )
                    }
                  />
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">Stripe Price ID</Label>
                  <Input
                    placeholder="price_..."
                    className="h-8 text-sm"
                    value={pkg.stripe_price_id ?? ""}
                    onChange={(e) =>
                      setCreditPackages((prev) =>
                        prev.map((p, j) =>
                          j === i
                            ? {
                                ...p,
                                stripe_price_id: e.target.value || null,
                              }
                            : p
                        )
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">$/Credit</Label>
                  <p className="h-8 flex items-center text-sm text-muted-foreground">
                    $
                    {pkg.credits > 0
                      ? (pkg.price_usd / pkg.credits).toFixed(3)
                      : "---"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() =>
                    setCreditPackages((prev) => prev.filter((_, j) => j !== i))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCreditPackages((prev) => [
                    ...prev,
                    { credits: 100, price_usd: 9.99, stripe_price_id: null },
                  ])
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Package
              </Button>
              <Button
                onClick={() => saveConfig("credit_packages", creditPackages)}
                disabled={saving === "credit_packages"}
                size="sm"
              >
                {saving === "credit_packages" ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save Packages
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Tab 4: Platform Stats ── */}
      <TabsContent value="stats" className="space-y-4">
        {statsLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {stats && !statsLoading && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                icon={Users}
                label="Organizations"
                value={stats.totalOrgs}
              />
              <StatCard
                icon={Users}
                label="Total Users"
                value={stats.totalUsers}
              />
              <StatCard
                icon={Database}
                label="Context Items"
                value={stats.totalContextItems.toLocaleString()}
              />
              <StatCard
                icon={Coins}
                label="Credits Used"
                value={stats.totalCreditsUsed.toLocaleString()}
              />
            </div>

            {/* Usage periods */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Usage by Period</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Period</th>
                        <th className="pb-2 pr-4 font-medium">Operations</th>
                        <th className="pb-2 pr-4 font-medium">Tokens</th>
                        <th className="pb-2 pr-4 font-medium">Cost</th>
                        <th className="pb-2 font-medium">Credits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <PeriodRow label="Today" data={stats.usage.today} />
                      <PeriodRow
                        label="This Week"
                        data={stats.usage.thisWeek}
                      />
                      <PeriodRow
                        label="This Month"
                        data={stats.usage.thisMonth}
                      />
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Profit margin */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Cost vs Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Total Cost
                    </p>
                    <p className="text-lg font-semibold">
                      ${stats.profitMargin.cost_usd.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Revenue
                    </p>
                    <p className="text-lg font-semibold text-green-600">
                      ${stats.profitMargin.revenue_usd.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Margin
                    </p>
                    <p className="text-lg font-semibold">
                      {stats.profitMargin.margin_pct}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Profit
                    </p>
                    <p className="text-lg font-semibold text-primary">
                      ${stats.profitMargin.profit_usd.toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* By model */}
            {stats.byModel.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Usage by Model</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Model</th>
                          <th className="pb-2 pr-4 font-medium">
                            Operations
                          </th>
                          <th className="pb-2 pr-4 font-medium">Tokens</th>
                          <th className="pb-2 font-medium">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {stats.byModel.map((m) => (
                          <tr key={m.model}>
                            <td className="py-2 pr-4">
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {m.model}
                              </code>
                            </td>
                            <td className="py-2 pr-4">{m.operations}</td>
                            <td className="py-2 pr-4">
                              {m.tokens.toLocaleString()}
                            </td>
                            <td className="py-2">
                              ${m.cost_usd.toFixed(4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={fetchStats}
              disabled={statsLoading}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh Stats
            </Button>
          </>
        )}

        {!stats && !statsLoading && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>Click the Stats tab to load platform statistics.</p>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <p className="text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function PeriodRow({ label, data }: { label: string; data: PeriodStats }) {
  return (
    <tr>
      <td className="py-2 pr-4 font-medium">{label}</td>
      <td className="py-2 pr-4">{data.operations}</td>
      <td className="py-2 pr-4">{data.tokens.toLocaleString()}</td>
      <td className="py-2 pr-4">${data.cost_usd.toFixed(4)}</td>
      <td className="py-2">{data.credits}</td>
    </tr>
  );
}
