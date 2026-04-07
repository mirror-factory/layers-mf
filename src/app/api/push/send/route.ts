import { NextRequest, NextResponse } from "next/server";
import { sendPushNotification } from "@/lib/notifications/send-push";

/**
 * POST /api/push/send
 * Internal endpoint to send push notifications to a user's devices.
 * Protected by CRON_SECRET -- only called by cron jobs / schedule executor.
 *
 * Body: { userId, title, body, link?, data? }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, title, body, link, data } = await request.json();

  if (!userId || !title || !body) {
    return NextResponse.json(
      { error: "Missing userId, title, or body" },
      { status: 400 },
    );
  }

  const result = await sendPushNotification({
    userId,
    title,
    body,
    link,
    data,
  });

  return NextResponse.json(result);
}
