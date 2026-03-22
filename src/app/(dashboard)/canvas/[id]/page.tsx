import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { CanvasWorkspace } from "@/components/canvas/canvas-workspace";

export default async function CanvasWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) notFound();

  // Verify canvas belongs to user's org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- canvas tables not yet in generated types
  const { data: canvas } = await (supabase as any)
    .from("canvases")
    .select("id, name")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .single();

  if (!canvas) notFound();

  return (
    <div className="h-[calc(100vh-3rem)] w-full overflow-hidden relative">
      <CanvasWorkspace canvasId={id} />
    </div>
  );
}
