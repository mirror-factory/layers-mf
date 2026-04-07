import { redirect } from "next/navigation";

export const metadata = { title: "Integrations" };

/**
 * @deprecated The integrations page has been merged into /connectors.
 * This redirect ensures existing bookmarks and links still work.
 */
export default function IntegrationsPage() {
  redirect("/connectors");
}
