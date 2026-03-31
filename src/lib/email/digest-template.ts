import { DigestData, DigestItem } from "./digest";

const APP_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const PRIORITY_COLORS: Record<DigestItem["priority"], string> = {
  urgent: "#dc2626",
  high: "#ea580c",
  normal: "#2563eb",
  low: "#6b7280",
};

const TYPE_LABELS: Record<DigestItem["type"], string> = {
  new_context: "New",
  action_item: "Action",
  decision: "Decision",
  mention: "Mention",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderItem(item: DigestItem): string {
  const color = PRIORITY_COLORS[item.priority];
  const label = TYPE_LABELS[item.type];
  return `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6;">
        <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; color: #fff; background-color: ${color}; margin-right: 8px;">${label}</span>
        <a href="${escapeHtml(item.url)}" style="color: #111827; text-decoration: none; font-size: 14px; font-weight: 500;">${escapeHtml(item.title)}</a>
        <br/>
        <span style="font-size: 12px; color: #9ca3af; margin-top: 2px;">${escapeHtml(item.source)}</span>
      </td>
    </tr>`;
}

function renderSection(
  title: string,
  items: DigestItem[],
  emptyMessage?: string
): string {
  if (items.length === 0 && !emptyMessage) return "";
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      <tr>
        <td style="padding: 0 0 8px 0;">
          <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">${escapeHtml(title)}</h2>
        </td>
      </tr>
      ${
        items.length > 0
          ? items.map(renderItem).join("")
          : `<tr><td style="padding: 12px 16px; color: #9ca3af; font-size: 14px;">${emptyMessage}</td></tr>`
      }
    </table>`;
}

/** Generate HTML email template for the daily digest */
export function renderDigestHTML(data: DigestData): string {
  const decisions = data.items.filter((i) => i.type === "decision");
  const actionItems = data.items.filter((i) => i.type === "action_item");
  const mentions = data.items.filter((i) => i.type === "mention");
  const newContext = data.items.filter((i) => i.type === "new_context");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Granger Daily Digest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 24px 16px 24px; background-color: #111827;">
              <h1 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Good morning, ${escapeHtml(data.userName)}</h1>
              <p style="margin: 0; font-size: 14px; color: #9ca3af;">Here's your Granger digest for ${escapeHtml(data.date)}</p>
            </td>
          </tr>

          <!-- Summary bar -->
          <tr>
            <td style="padding: 16px 24px; background-color: #f8fafc; border-bottom: 1px solid #e5e7eb;">
              <span style="font-size: 13px; color: #6b7280;">
                ${data.newContextCount} new item${data.newContextCount !== 1 ? "s" : ""} in your knowledge base
                ${data.overdueActions.length > 0 ? ` &middot; <strong style="color: #dc2626;">${data.overdueActions.length} overdue action${data.overdueActions.length !== 1 ? "s" : ""}</strong>` : ""}
              </span>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 24px;">
              ${renderSection("Action items needing attention", [...data.overdueActions, ...actionItems])}
              ${renderSection("Key decisions", decisions)}
              ${renderSection("Mentions", mentions)}
              ${renderSection("New in your knowledge base", newContext.slice(0, 10))}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid #e5e7eb; text-align: center;">
              <a href="${APP_URL}/settings/notifications" style="font-size: 12px; color: #6b7280; text-decoration: underline;">Manage notification preferences</a>
              <span style="font-size: 12px; color: #d1d5db;"> &middot; </span>
              <a href="${APP_URL}/settings/notifications" style="font-size: 12px; color: #6b7280; text-decoration: underline;">Unsubscribe from digest</a>
            </td>
          </tr>
        </table>

        <p style="margin: 16px 0 0 0; font-size: 11px; color: #9ca3af; text-align: center;">
          Granger by Mirror Factory
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
