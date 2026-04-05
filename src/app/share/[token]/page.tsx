import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { NeuralDots } from "@/components/ui/neural-dots";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared Conversation — Layers",
};

export default async function SharedChatPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Use admin client to bypass RLS — this is a public endpoint
  // Security: validated by share_token lookup + is_active check
  const adminDb = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = adminDb as any;

  // Look up the share token (no auth required for public shares)
  const { data: share } = await sb
    .from("public_chat_shares")
    .select("conversation_id, org_id, is_active, allow_public_view, shared_by")
    .eq("share_token", token)
    .eq("is_active", true)
    .single();

  if (!share) notFound();

  // For org-only shares, verify the viewer is in the org
  if (!share.allow_public_view) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) notFound();
    const { data: member } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("org_id", share.org_id)
      .single();
    if (!member) notFound();
  }

  // Fetch conversation + messages
  const { data: conversation } = await sb
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .eq("id", share.conversation_id)
    .single();

  const { data: messages } = await sb
    .from("chat_messages")
    .select("role, parts, created_at")
    .eq("conversation_id", share.conversation_id)
    .order("created_at", { ascending: true });

  if (!conversation || !messages) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chatMessages = messages as { role: string; parts: any[]; created_at: string }[];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <NeuralDots size={28} dotCount={8} active={false} />
          <div>
            <h1 className="text-sm font-medium">{conversation.title ?? "Conversation"}</h1>
            <p className="text-[10px] text-muted-foreground">
              Shared from Layers &middot; {new Date(conversation.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {chatMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-card border rounded-bl-md"
              }`}
            >
              {msg.parts?.map((part: { type: string; text?: string }, j: number) => {
                if (part.type === "text" && part.text) {
                  return (
                    <div key={j} className="whitespace-pre-wrap break-words prose prose-sm dark:prose-invert max-w-none">
                      {part.text}
                    </div>
                  );
                }
                if (part.type?.startsWith("tool-")) {
                  const toolName = part.type.replace("tool-", "");
                  return (
                    <div key={j} className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                      <span className="text-primary">&#10003;</span>
                      <span>{toolName.replace(/_/g, " ")}</span>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/50 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by <span className="text-primary font-medium">Layers</span> &middot; AI OS for knowledge teams
        </p>
      </footer>
    </div>
  );
}
