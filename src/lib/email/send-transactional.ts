import { Resend } from "resend";

export type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/** Sends one transactional message. No-ops when Resend is not configured. */
export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    return { ok: false, error: "Email not configured" };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "send failed",
    };
  }
}
