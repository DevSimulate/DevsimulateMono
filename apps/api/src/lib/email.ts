import axios from "axios";

/**
 * Sends transactional email via Resend (https://resend.com).
 * Set RESEND_API_KEY and (optionally) EMAIL_FROM in the environment.
 * No-ops gracefully if no key is configured, so the app never crashes —
 * it just logs and returns false.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "DevSimulate <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping send to", opts.to);
    return false;
  }

  try {
    await axios.post(
      "https://api.resend.com/emails",
      { from, to: opts.to, subject: opts.subject, html: opts.html },
      { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } }
    );
    return true;
  } catch (err) {
    const detail = axios.isAxiosError(err) ? JSON.stringify(err.response?.data) : String(err);
    console.error("[email] Failed to send to", opts.to, detail);
    return false;
  }
}

/**
 * Builds the interview-invite email for a shortlisted candidate.
 */
export function interviewInviteEmail(opts: {
  candidateName: string;
  companyName: string;
  roleName: string;
  score: number;
  bookingLink: string | null;
}): { subject: string; html: string } {
  const { candidateName, companyName, roleName, score, bookingLink } = opts;
  const subject = `You've been shortlisted — ${roleName} at ${companyName}`;

  const cta = bookingLink
    ? `<a href="${bookingLink}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;font-size:14px;">Book your interview slot →</a>`
    : `<p style="color:#666;font-size:14px;">The hiring team will reach out with next steps.</p>`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a;">
    <div style="font-weight:800;font-size:18px;margin-bottom:24px;">⚡ DevSimulate</div>
    <h1 style="font-size:22px;margin:0 0 16px;">You've been shortlisted 🎉</h1>
    <p style="font-size:15px;line-height:1.6;color:#333;">
      Hi ${candidateName},<br><br>
      You scored <strong>${score}/100</strong> on the <strong>${companyName}</strong>
      <strong>${roleName}</strong> assessment on DevSimulate. The team was impressed and
      would like to invite you for an interview.
    </p>
    <div style="margin:24px 0;">${cta}</div>
    <p style="font-size:13px;color:#888;line-height:1.6;">
      We look forward to speaking with you.<br>
      — The ${companyName} Hiring Team
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="font-size:12px;color:#aaa;">Sent via DevSimulate on behalf of ${companyName}.</p>
  </div>`;

  return { subject, html };
}
