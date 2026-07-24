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
  /** Where candidate replies should go (e.g. the recruiter's own address). */
  replyTo?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "DevSimulate <onboarding@resend.dev>";
  const replyTo = opts.replyTo ?? process.env.EMAIL_REPLY_TO;

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping send to", opts.to);
    return false;
  }

  try {
    await axios.post(
      "https://api.resend.com/emails",
      {
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      },
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
 * Builds the ASSESSMENT invitation email — sent to a candidate list before
 * anyone has an account. Rendered in the hiring organisation's branding
 * (logo, brand name, colour), falling back to DevSimulate's if unset.
 */
export function assessmentInviteEmail(opts: {
  candidateName: string | null;
  brandName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  roleName: string;
  link: string;
  deadline: Date | null;
  expectedMinutes: number | null;
}): { subject: string; html: string } {
  const {
    candidateName, brandName, logoUrl, primaryColor,
    roleName, link, deadline, expectedMinutes,
  } = opts;

  const accent = primaryColor || "#6366f1";
  const greeting = candidateName?.trim() ? candidateName.trim().split(" ")[0] : "there";
  const subject = `Your technical assessment — ${roleName} at ${brandName}`;

  const header = logoUrl
    ? `<img src="${logoUrl}" alt="${brandName}" style="max-height:40px;max-width:180px;display:block;margin-bottom:24px;">`
    : `<div style="font-weight:800;font-size:18px;margin-bottom:24px;color:${accent};">${brandName}</div>`;

  const deadlineLine = deadline
    ? `<li style="margin-bottom:6px;">Complete it by <strong>${deadline.toDateString()}</strong></li>`
    : "";
  const timeLine = expectedMinutes
    ? `<li style="margin-bottom:6px;">Takes about <strong>${expectedMinutes} minutes</strong></li>`
    : "";

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a;">
    ${header}
    <h1 style="font-size:22px;margin:0 0 16px;">You're invited to a technical assessment</h1>
    <p style="font-size:15px;line-height:1.6;color:#333;">
      Hi ${greeting},<br><br>
      As the next step for the <strong>${roleName}</strong> role at <strong>${brandName}</strong>,
      we'd like you to complete a short hands-on assessment. You'll diagnose and fix a real issue
      in a working codebase — not a quiz.
    </p>
    <ul style="font-size:14px;line-height:1.6;color:#333;padding-left:20px;margin:16px 0;">
      ${timeLine}
      ${deadlineLine}
      <li style="margin-bottom:6px;">You may use AI tools — we care how you work in reality</li>
    </ul>
    <div style="margin:24px 0;">
      <a href="${link}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;font-size:14px;">
        Start your assessment →
      </a>
    </div>
    <p style="font-size:12px;color:#888;line-height:1.6;">
      This link is personal to you — please don't share it.<br>
      If the button doesn't work, paste this into your browser:<br>
      <span style="color:#aaa;word-break:break-all;">${link}</span>
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="font-size:12px;color:#aaa;">Sent via DevSimulate on behalf of ${brandName}.</p>
  </div>`;

  return { subject, html };
}

/**
 * Nudge for a candidate whose assessment was reviewed but never completed —
 * almost always a failed mic or a closed tab at the verbal step.
 *
 * Tone matters here: they have already done the hard part and their score is
 * sitting unpublished through no fault of their own. This must read as "you're
 * one step away", never as a warning or a deadline threat.
 */
export function stuckAssessmentEmail(opts: {
  candidateName: string | null;
  ticketTitle: string;
  resumeLink: string;
  deadline: Date | null;
}): { subject: string; html: string } {
  const { candidateName, ticketTitle, resumeLink, deadline } = opts;
  const greeting = candidateName?.trim() ? candidateName.trim().split(" ")[0] : "there";
  const subject = "Your assessment is one step from complete";

  const deadlineLine = deadline
    ? `<p style="font-size:13px;color:#666;line-height:1.6;">Please finish by <strong>${deadline.toDateString()}</strong>, when this assessment closes.</p>`
    : "";

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a;">
    <div style="font-weight:800;font-size:18px;margin-bottom:24px;color:#5B5BD6;">DevSimulate</div>
    <h1 style="font-size:22px;margin:0 0 16px;">You're one step from finishing</h1>
    <p style="font-size:15px;line-height:1.6;color:#333;">
      Hi ${greeting},<br><br>
      Your work on <strong>${ticketTitle}</strong> has been reviewed, but the final
      spoken-explanation step wasn't completed — usually a microphone or browser
      issue rather than anything you did.
    </p>
    <p style="font-size:15px;line-height:1.6;color:#333;">
      Your result stays unpublished until that last step is done. It takes about
      two minutes, and you'll get a new question when you open the link.
    </p>
    <div style="margin:24px 0;">
      <a href="${resumeLink}" style="display:inline-block;background:#5B5BD6;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;font-size:14px;">
        Finish your assessment →
      </a>
    </div>
    ${deadlineLine}
    <p style="font-size:12px;color:#888;line-height:1.6;">
      If the button doesn't work, paste this into your browser:<br>
      <span style="color:#aaa;word-break:break-all;">${resumeLink}</span><br><br>
      If your microphone still won't work, reply to this email and we'll have it reviewed manually.
    </p>
  </div>`;

  return { subject, html };
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
