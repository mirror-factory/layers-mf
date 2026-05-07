import { redirect } from "next/navigation";

/**
 * /chat/[id] — Redirect to /chat?id=[id]
 * This gives each conversation a unique, shareable URL.
 */
export default async function ChatByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/chat?id=${id}`);
}
