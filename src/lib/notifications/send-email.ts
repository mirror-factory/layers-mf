import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

interface EmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!resend) {
    console.log("[email] RESEND_API_KEY not set -- email disabled");
    return false;
  }

  try {
    await resend.emails.send({
      from: "Granger <notifications@mirrorfactory.ai>",
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return true;
  } catch (err) {
    console.error("[email] Send failed:", err);
    return false;
  }
}
