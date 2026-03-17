/**
 * Super-admin utilities — shared across admin API routes.
 */

const SUPER_ADMIN_EMAILS = (
  process.env.SUPER_ADMIN_EMAILS ?? "alfonso@mirrorfactory.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase());

export function isSuperAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}
