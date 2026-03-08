import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  computeHealthSummary,
  type ContextHealthData,
  type AgentMetricsData,
} from "@/lib/kpi/compute";

export async function GET(request: NextRequest) {
  // Optional auth via secret header (for external monitoring)
  const secret = process.env.HEALTH_CHECK_SECRET;
  if (secret) {
    const provided = request.headers.get("x-health-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const orgId = request.nextUrl.searchParams.get("org_id");
  if (!orgId) {
    return NextResponse.json(
      { error: "org_id query parameter required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const [contextRes, integrationsRes, agentRes] = await Promise.all([
    admin.rpc("get_context_health", { p_org_id: orgId }),
    admin.rpc("get_integration_health", { p_org_id: orgId }),
    admin.rpc("get_agent_metrics", { p_org_id: orgId }),
  ]);

  if (contextRes.error || agentRes.error) {
    return NextResponse.json(
      {
        error: "RPC error",
        details: {
          context: contextRes.error?.message,
          agent: agentRes.error?.message,
        },
      },
      { status: 500 }
    );
  }

  const contextData = contextRes.data as unknown as ContextHealthData;
  const agentData = agentRes.data as unknown as AgentMetricsData;
  const summary = computeHealthSummary(contextData, agentData);

  return NextResponse.json({
    status: summary.status,
    timestamp: new Date().toISOString(),
    context_health: {
      kpis: summary.context,
      sources: summary.sources,
      raw: contextData,
    },
    integrations: integrationsRes.data ?? [],
    agent: {
      kpis: summary.agent,
      raw: agentData,
    },
  });
}
