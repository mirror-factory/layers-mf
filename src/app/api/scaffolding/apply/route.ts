import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTemplateById } from "@/lib/scaffolding/templates";
import { calculateNextCron } from "@/lib/cron";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!member) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const templateId = body?.templateId;

  if (!templateId || typeof templateId !== "string") {
    return NextResponse.json(
      { error: "Missing required field: templateId" },
      { status: 400 },
    );
  }

  const template = getTemplateById(templateId);
  if (!template) {
    return NextResponse.json(
      { error: `Unknown template: ${templateId}` },
      { status: 404 },
    );
  }

  const results = {
    docsCreated: 0,
    schedulesCreated: 0,
    permissionsSet: false,
    errors: [] as string[],
  };

  // 1. Create priority documents as context_items
  if (template.priorityDocs.length > 0) {
    const docRows = template.priorityDocs.map((doc) => ({
      org_id: member.org_id,
      source_type: "upload",
      title: doc.filename,
      raw_content: doc.content,
      content_type: "markdown",
      status: "ready",
    }));

    const { data: docs, error: docsError } = await supabase
      .from("context_items")
      .insert(docRows)
      .select("id");

    if (docsError) {
      results.errors.push(`Priority docs: ${docsError.message}`);
    } else {
      results.docsCreated = docs?.length ?? 0;
    }
  }

  // 2. Create scheduled actions
  if (template.defaultSchedules.length > 0) {
    const scheduleRows = template.defaultSchedules.map((sched) => ({
      org_id: member.org_id,
      created_by: user.id,
      name: sched.name,
      description: sched.description,
      action_type: sched.action_type,
      target_service: sched.target_service,
      payload: sched.payload,
      schedule: sched.schedule,
      next_run_at: calculateNextCron(sched.schedule),
      status: "active",
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: schedules, error: schedError } = await (supabase as any)
      .from("scheduled_actions")
      .insert(scheduleRows)
      .select("id");

    if (schedError) {
      results.errors.push(`Schedules: ${schedError.message}`);
    } else {
      results.schedulesCreated = schedules?.length ?? 0;
    }
  }

  // 3. Set default tool permissions on ditto_profiles
  if (Object.keys(template.defaultPermissions).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: permError } = await (supabase as any)
      .from("ditto_profiles")
      .upsert(
        {
          org_id: member.org_id,
          user_id: user.id,
          preferred_sources: template.defaultPermissions,
        },
        { onConflict: "org_id,user_id" },
      );

    if (permError) {
      results.errors.push(`Permissions: ${permError.message}`);
    } else {
      results.permissionsSet = true;
    }
  }

  const status = results.errors.length > 0 ? 207 : 201;
  return NextResponse.json(
    {
      templateId: template.id,
      templateName: template.name,
      ...results,
      suggestedIntegrations: template.suggestedIntegrations,
    },
    { status },
  );
}
