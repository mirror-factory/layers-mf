import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "./send-email";
import { sendPushNotification } from "./send-push";

interface NotifyParams {
  userId: string;
  orgId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Send a notification across all enabled channels:
 * 1. In-app (always) -- inserts into notifications table
 * 2. Push (if device registered) -- sends via APNs/FCM
 * 3. Email (if preferences allow) -- sends via Resend
 */
export async function notify(params: NotifyParams): Promise<void> {
  const supabase = createAdminClient();

  // 1. Always create in-app notification
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("notifications").insert({
    org_id: params.orgId,
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    link: params.link,
    metadata: params.metadata ?? {},
  });

  // 2. Send push notification (if tokens exist)
  try {
    await sendPushNotification({
      userId: params.userId,
      title: params.title,
      body: params.body,
      link: params.link,
    });
  } catch {
    /* silent -- push is best-effort */
  }

  // 3. Check email preferences and send if enabled
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prefs } = await (supabase as any)
      .from("notification_preferences")
      .select("*")
      .eq("user_id", params.userId)
      .single();

    // Map notification type to preference field
    const shouldEmail = (() => {
      if (!prefs) return false; // No prefs = no email
      switch (params.type) {
        case "chat_mention":
          return prefs.email_on_mention;
        case "approval_needed":
          return prefs.email_on_action_item;
        case "library_update":
          return prefs.email_on_new_context;
        case "schedule_started":
          return false; // in-app only; avoid email spam for starts
        case "schedule_complete":
          return prefs.digest_enabled; // included in digest
        case "system_message":
          return false; // in-app/push only — AI-initiated chat updates
        case "mcp_health_failed":
          return prefs.email_on_system_alert ?? false;
        case "credit_low":
          return true; // always email for credit alerts
        case "system_alert":
          return prefs.email_on_system_alert ?? true;
        default:
          return false;
      }
    })();

    if (shouldEmail) {
      // Get user email
      const {
        data: { user },
      } = await supabase.auth.admin.getUserById(params.userId);
      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: params.title,
          text:
            params.body +
            (params.link
              ? `\n\nView: https://layers.hustletogether.com${params.link}`
              : ""),
        });
      }
    }
  } catch {
    /* silent -- email is best-effort */
  }
}
