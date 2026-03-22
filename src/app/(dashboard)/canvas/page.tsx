export const metadata = { title: "Canvas" };

import { createClient } from "@/lib/supabase/server";
import { CanvasList } from "@/components/canvas/canvas-list";

export default async function CanvasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user!.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- canvas tables not yet in generated types
  const { data: canvases } = member
    ? await (supabase as any)
        .from("canvases")
        .select(
          "id, name, description, viewport, created_at, updated_at, canvas_items(id)"
        )
        .eq("org_id", member.org_id)
        .order("updated_at", { ascending: false })
    : { data: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = ((canvases ?? []) as any[]).map((c: any) => ({
    id: c.id as string,
    name: c.name as string,
    description: (c.description ?? "") as string,
    itemCount: Array.isArray(c.canvas_items) ? c.canvas_items.length : 0,
    updatedAt: c.updated_at as string,
  }));

  return (
    <div className="flex flex-col p-4 sm:p-8 gap-4 sm:gap-6 min-h-screen">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-1">Canvas</h1>
          <p className="text-muted-foreground text-sm">
            Visually explore and connect your knowledge base.
          </p>
        </div>
      </div>
      <CanvasList canvases={mapped} />
    </div>
  );
}
