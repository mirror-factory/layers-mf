/**
 * @deprecated Nango client — kept for backward compatibility with existing
 * Nango webhook handlers and sync routes. New integrations use MCP servers.
 * This file can be removed once all Nango connections have been migrated.
 */
import { Nango } from "@nangohq/node";

// Server-side Nango client (secret key) — gracefully handles missing key
export const nango = new Nango({
  secretKey: process.env.NANGO_SECRET_KEY ?? "nango-deprecated",
});
