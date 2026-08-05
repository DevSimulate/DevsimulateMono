import axios from "axios";
import { EmailType, EmailStatus } from "@prisma/client";
import prisma from "./prisma";

/** Metadata that ties a send to its delivery-tracking row (Fix 4). */
export interface EmailMeta {
  type?: EmailType;
  submissionId?: string | null;
  campaignId?: string | null;
  userId?: string | null;
  actionLine?: string | null;
}

/** Best-effort delivery record — tracking must never break a send. */
async function recordDelivery(
  opts: { to: string; subject: string; meta?: EmailMeta },
  status: EmailStatus,
  resendId: string | null
): Promise<void> {
  try {
    await prisma.emailDelivery.create({
      data: {
        resendId,
        status,
        type: opts.meta?.type ?? EmailType.OTHER,
        toEmail: opts.to,
        subject: opts.subject,
        actionLine: opts.meta?.actionLine ?? null,
        submissionId: opts.meta?.submissionId ?? null,
        campaignId: opts.meta?.campaignId ?? null,
        userId: opts.meta?.userId ?? null,
      },
    });
  } catch (err) {
    console.error("[email] failed to record delivery:", err instanceof Error ? err.message : err);
  }
}

/**
 * The DevSimulate lockup for transactional email — the real icon (hosted at
 * /icon.svg, the same mark used as the site favicon) next to the wordmark,
 * laid out with inline-block + vertical-align instead of flexbox so it holds
 * together in Outlook, not just Gmail/Apple Mail. Used on every DevSimulate-
 * branded email; the employer-branded assessment invite uses the hiring
 * org's own logo instead (see assessmentInviteEmail).
 */
function devSimulateHeader(): string {
  const appUrl = process.env.FRONTEND_URL ?? "https://www.devsimulate.com";
  return `
  <div style="margin-bottom:24px;">
    <img src="${appUrl}/icon.svg" width="28" height="28" alt="DevSimulate" style="vertical-align:middle;border-radius:7px;display:inline-block;">
    <span style="font-weight:800;font-size:18px;color:#1a1a1a;vertical-align:middle;margin-left:8px;">DevSimulate</span>
  </div>`;
}

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
  /** Delivery-tracking metadata (Fix 4). A row is written for every attempt. */
  meta?: EmailMeta;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "DevSimulate <onboarding@resend.dev>";
  const replyTo = opts.replyTo ?? process.env.EMAIL_REPLY_TO;

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping send to", opts.to);
    await recordDelivery(opts, EmailStatus.FAILED, null);
    return false;
  }

  try {
    const res = await axios.post<{ id?: string }>(
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
    await recordDelivery(opts, EmailStatus.SENT, res.data?.id ?? null);
    return true;
  } catch (err) {
    const detail = axios.isAxiosError(err) ? JSON.stringify(err.response?.data) : String(err);
    console.error("[email] Failed to send to", opts.to, detail);
    await recordDelivery(opts, EmailStatus.FAILED, null);
    return false;
  }
}

/**
 * Where candidate questions and data-deletion requests from an invite are
 * directed. Must reach the company doing the HIRING — a candidate asking to
 * have their interview recording deleted is exercising a right against the
 * employer, and DevSimulate cannot action it on their behalf.
 *
 * The default is LMKR's because they are the only hiring client and this is
 * their pilot. That is a stopgap, not a design: it is wrong the moment a second
 * employer exists, and REVIEW_CONTACT_EMAIL is deliberately NOT in the chain —
 * that one is the appeals address and points at DevSimulate, so falling through
 * to it would quietly send data requests to the wrong company again.
 *
 * Proper fix when client #2 arrives: `contactEmail` on Organisation, resolved
 * per campaign and editable from the dashboard.
 */
const ASSESSMENT_CONTACT_EMAIL =
  process.env.ASSESSMENT_CONTACT_EMAIL ?? "OZulfiqar@lmkr.com";

/** "Wednesday, 5 August 2026" — pinned to UTC so the weekday can't drift with server TZ. */
function longDate(d: Date): string {
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  const rest = d.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
  return `${weekday}, ${rest}`;
}

/**
 * Builds the ASSESSMENT invitation email — sent to a candidate list before
 * anyone has an account. Rendered in the hiring organisation's branding
 * (logo, brand name, colour), falling back to DevSimulate's if unset.
 *
 * The copy carries weight beyond politeness. It sets the one expectation the
 * assessment depends on — AI is welcome while building, absent while
 * explaining — and it front-loads every proctoring rule, because a candidate
 * who first meets fullscreen and paste-blocking mid-assessment reads them as a
 * trap. It also states plainly that no score is shown, so silence at the end
 * isn't mistaken for rejection.
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
  /** Reply target for candidate questions. Defaults to ASSESSMENT_CONTACT_EMAIL. */
  contactEmail?: string | null;
}): { subject: string; html: string } {
  const {
    candidateName, brandName, logoUrl, primaryColor,
    roleName, link, deadline, expectedMinutes,
  } = opts;

  const accent = primaryColor || "#6366f1";
  const greeting = candidateName?.trim() ? candidateName.trim().split(" ")[0] : "there";
  const contact = opts.contactEmail?.trim() || ASSESSMENT_CONTACT_EMAIL;
  const minutes = expectedMinutes ?? 60;
  // Static page in the web app's public/ — a candidate who reads this before
  // starting is one who doesn't meet fullscreen or the paste block by surprise.
  const guideUrl = `${process.env.FRONTEND_URL ?? "https://www.devsimulate.com"}/assessment-guide.html`;
  const subject = `Your next step for the ${roleName} role at ${brandName}`;

  const header = logoUrl
    ? `<img src="${logoUrl}" alt="${brandName}" style="max-height:40px;max-width:180px;display:block;margin-bottom:24px;">`
    : `<div style="font-weight:800;font-size:18px;margin-bottom:24px;color:${accent};">${brandName}</div>`;

  const p = "font-size:15px;line-height:1.6;color:#333;margin:0 0 14px;";
  const h2 = "font-size:15px;font-weight:700;color:#1a1a1a;margin:26px 0 8px;";
  const li = "margin-bottom:7px;";

  const deadlineSentence = deadline
    ? ` Please try to finish by <strong>${longDate(deadline)}</strong>, as the link stops working after that.`
    : "";

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Use AI to build the fix, then walk us through it in your own words.
    </div>
    ${header}

    <p style="${p}">Hi ${greeting},</p>

    <p style="${p}">
      Thank you for your interest in the <strong>${roleName}</strong> role at <strong>${brandName}</strong>.
      For the next step, we'd love for you to work through a short, hands-on assessment. It's a real
      task rather than a quiz: you'll fix an issue in a working codebase, then talk us through what you did.
    </p>

    <div style="${h2}">Part 1: Fix the code</div>
    <p style="${p}">
      Work in your own editor, at your own pace. Feel free to use AI tools like Copilot, Claude, or
      ChatGPT if that's part of your routine. We're not testing whether you can code without help,
      just that you understand the change you're shipping. This part isn't timed or monitored.
    </p>

    <div style="${h2}">Part 2: Talk us through it</div>
    <p style="${p}">
      Once you open the assessment in your browser, you'll explain your own work. No AI this time,
      and you won't be able to go back to your code. You'll write a short explanation covering four things:
    </p>
    <ul style="font-size:15px;line-height:1.6;color:#333;padding-left:20px;margin:0 0 14px;">
      <li style="${li}"><strong>Root cause.</strong> What was actually broken, and why?</li>
      <li style="${li}"><strong>How you found it.</strong> What you read, ran, or tested to confirm it.</li>
      <li style="${li}"><strong>Why this fix.</strong> Why this approach, and any trade-off you accepted.</li>
      <li style="${li}"><strong>How you verified it.</strong> What showed you that it works now.</li>
    </ul>
    <p style="${p}">
      After that, there are two quick follow-up questions and a brief spoken explanation with your
      camera and mic on. It's all about the code you just wrote, so the best prep is simply being
      able to explain your fix from memory.
    </p>

    <div style="${h2}">Before you start</div>
    <p style="${p}">
      Set aside about ${minutes} minutes somewhere quiet, use Chrome or Edge on a laptop or desktop,
      and have a working mic and camera ready (there's a quick mic check first).
    </p>
    <p style="${p}">
      A few things about Part 2, just so nothing catches you out: it runs in fullscreen, and switching
      tabs or apps gets noted (you'll get two reminders before a third would end the session). Pasting
      into the answer boxes is turned off, though trying it won't end anything. And if your mic acts up,
      don't worry or close the tab, you'll be offered a retry or the option to type instead.
    </p>

    <div style="${h2}">Getting started</div>
    <ol style="font-size:15px;line-height:1.6;color:#333;padding-left:20px;margin:0 0 14px;">
      <li style="${li}">Install the DevSimulate extension for VS Code and sign in with GitHub.</li>
      <li style="${li}">Open your assigned ticket in the DevSimulate sidebar.</li>
      <li style="${li}">Click &ldquo;Fork &amp; Clone&rdquo; and work in that clone.</li>
      <li style="${li}">Fix the issue, using AI freely.</li>
      <li style="${li}">Click &ldquo;Push &amp; Create PR,&rdquo; then &ldquo;Submit PR for Review.&rdquo;</li>
      <li style="${li}">Complete the write-up, follow-up questions, and spoken explanation in your browser.</li>
    </ol>
    <p style="${p}">
      Worth flagging: &ldquo;Submit PR for Review&rdquo; is the point where Part 2 begins and you can't
      return to your code, so click it once you're ready.
    </p>

    <div style="margin:28px 0;">
      <a href="${link}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:8px;font-size:15px;">
        Start your assessment &rarr;
      </a>
    </div>

    <p style="${p}">
      Want to see the whole thing laid out first?
      <a href="${guideUrl}" style="color:${accent};">Read the step-by-step guide</a> —
      it walks through every stage, what's monitored, and what to do if something goes wrong.
    </p>

    <div style="${h2}">A few notes</div>
    <p style="${p}">
      You won't see a score at the end, and no candidate does, so please don't read anything into it.
      The ${brandName} hiring team will review your assessment alongside the rest of your application
      and get back to you either way.${deadlineSentence}
    </p>
    <p style="${p}">
      Your solution is submitted as a pull request on a public GitHub repository, so it may be visible to others.
    </p>
    <p style="${p}">
      By starting, you agree that ${brandName} and DevSimulate may store your submission (your code,
      written answers, and the recording and transcript of your spoken explanation) to evaluate you for
      this and future roles. You can ask us to delete it anytime by writing to
      <a href="mailto:${contact}" style="color:${accent};">${contact}</a>, and if you'd rather we didn't
      keep it, just reply before you begin. Your link is personal to you, so please don't share it.
    </p>
    <p style="${p}">
      If anything is unclear, just reply here or email
      <a href="mailto:${contact}" style="color:${accent};">${contact}</a> and a real person will help.
    </p>

    <p style="${p}">Good luck. We're looking forward to seeing how you work.</p>

    <p style="font-size:12px;color:#888;line-height:1.6;margin-top:22px;">
      If the button doesn't work, paste this into your browser:<br>
      <span style="color:#aaa;word-break:break-all;">${link}</span>
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="font-size:12px;color:#aaa;">Sent via DevSimulate on behalf of ${brandName}.</p>
  </div>`;

  return { subject, html };
}

/**
 * The last-call email, written to serve BOTH states in one message: invited and
 * never started, and started but not finished.
 *
 * One email rather than two because the split is not knowable from the outside
 * in the way that matters — someone who "started" may have opened the link and
 * hit a setup error, which is closer to never-started than to half-done. Two
 * emails would also mean two chances to send the wrong one to the wrong person
 * on the last day.
 *
 * It carries the common setup failures inline. Several candidates in the pilot
 * were blocked by "not a git repository", a missing Git install, or VS Code
 * having the wrong folder open — none of which they could have diagnosed alone.
 * A deadline reminder that doesn't acknowledge that reads as pressure to
 * someone who has been stuck for two days.
 */
export function closingSoonEmail(opts: {
  candidateName: string | null;
  brandName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  roleName: string;
  link: string;
  deadline: Date | null;
  /**
   * Accepted but unused. ONE message covers both states by addressing each in a
   * sentence, rather than two templates that double the send count against an
   * email quota and double the chance of the wrong variant reaching someone.
   */
  started?: boolean;
  contactEmail?: string | null;
}): { subject: string; html: string } {
  const { candidateName, brandName, logoUrl, primaryColor, roleName, link, deadline } = opts;

  const accent = primaryColor || "#6366f1";
  const greeting = candidateName?.trim() ? candidateName.trim().split(" ")[0] : "there";
  const contact = opts.contactEmail?.trim() || ASSESSMENT_CONTACT_EMAIL;
  const guideUrl = `${process.env.FRONTEND_URL ?? "https://www.devsimulate.com"}/assessment-guide.html`;
  const subject = `Your ${brandName} assessment closes ${deadline ? "soon" : "shortly"}`;

  const header = logoUrl
    ? `<img src="${logoUrl}" alt="${brandName}" style="max-height:40px;max-width:180px;display:block;margin-bottom:24px;">`
    : `<div style="font-weight:800;font-size:18px;margin-bottom:24px;color:${accent};">${brandName}</div>`;

  const p = "font-size:15px;line-height:1.6;color:#333;margin:0 0 14px;";
  const when = deadline ? `on <strong>${longDate(deadline)}</strong>` : "shortly";

  return {
    subject,
    html: `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Your assessment link closes soon — your progress is saved.
    </div>
    ${header}

    <p style="${p}">Hi ${greeting},</p>

    <p style="${p}">
      A quick reminder that your technical assessment for the <strong>${roleName}</strong> role at
      <strong>${brandName}</strong> closes ${when}.
    </p>

    <p style="${p}">
      <strong>If you haven't started yet</strong> — there's still time. It takes about an hour: you fix
      a real bug in a working codebase, then explain your reasoning. You're welcome to use AI tools for
      the coding; we're interested in whether you understand the change, not whether you typed it unaided.
    </p>

    <p style="${p}">
      <strong>If you started but didn't finish</strong> — your work is saved. Open your link again and
      you'll be returned to the exact step you stopped on. Nothing you've already completed needs redoing.
    </p>

    <div style="margin:26px 0;">
      <a href="${link}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:8px;font-size:15px;">
        Open your assessment &rarr;
      </a>
    </div>

    <p style="${p}">
      <strong>If something went wrong technically, please tell us rather than giving up.</strong>
      A few candidates hit setup problems this week and every one turned out to be a quick fix:
    </p>
    <ul style="font-size:14.5px;line-height:1.6;color:#333;padding-left:20px;margin:0 0 14px;">
      <li style="margin-bottom:6px;"><em>"not a git repository"</em> — VS Code has the wrong folder open, or an interrupted download left an empty folder behind</li>
      <li style="margin-bottom:6px;"><em>"spawn git ENOENT"</em> — Git isn't installed yet. Install it from git-scm.com, then restart VS Code</li>
      <li style="margin-bottom:6px;">Sidebar looks empty — open the folder you cloned into, then click the refresh icon</li>
    </ul>

    <p style="${p}">
      Stuck on any of these, or on anything else? Email
      <a href="mailto:${contact}" style="color:${accent};">${contact}</a> and we'll help.
      If a technical problem is what stopped you, say so — we'd much rather sort it out than lose
      your application to a setup error.
    </p>

    <p style="${p}">
      There's a step-by-step walkthrough here:
      <a href="${guideUrl}" style="color:${accent};">${guideUrl.replace(/^https?:\/\//, "")}</a>
    </p>

    <p style="${p}">Thanks for the time you've put in so far.</p>

    <p style="font-size:12px;color:#888;line-height:1.6;margin-top:22px;">
      If the button doesn't work, paste this into your browser:<br>
      <span style="color:#aaa;word-break:break-all;">${link}</span>
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="font-size:12px;color:#aaa;">Sent via DevSimulate on behalf of ${brandName}.</p>
  </div>`,
  };
}

/**
 * Nudge for an invited candidate who never opened their assessment.
 *
 * Deliberately SHORT, and deliberately not a re-send of the invite. This lands
 * every couple of days, so repeating the full instructions each time reads as
 * spam and trains people to ignore it. Everything they need to decide is here —
 * the link and how long is left — and the detail is still in the first email.
 *
 * Tone matters as much as it does in the stuck-assessment nudge: someone who
 * hasn't started is usually busy, not uninterested. No guilt, no "final notice".
 */
export function assessmentReminderEmail(opts: {
  candidateName: string | null;
  brandName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  roleName: string;
  link: string;
  deadline: Date | null;
  daysLeft: number | null;
}): { subject: string; html: string } {
  const { candidateName, brandName, logoUrl, primaryColor, roleName, link, deadline, daysLeft } = opts;

  const accent = primaryColor || "#6366f1";
  const greeting = candidateName?.trim() ? candidateName.trim().split(" ")[0] : "there";
  const subject = `A reminder: your ${roleName} assessment at ${brandName}`;

  const header = logoUrl
    ? `<img src="${logoUrl}" alt="${brandName}" style="max-height:40px;max-width:180px;display:block;margin-bottom:24px;">`
    : `<div style="font-weight:800;font-size:18px;margin-bottom:24px;color:${accent};">${brandName}</div>`;

  const p = "font-size:15px;line-height:1.6;color:#333;margin:0 0 14px;";

  // "1 day left" reads as pressure; "today" reads as information.
  const timeLine =
    daysLeft === null || !deadline
      ? ""
      : daysLeft <= 0
        ? `<p style="${p}">Your link closes <strong>today</strong>.</p>`
        : daysLeft === 1
          ? `<p style="${p}">Your link closes <strong>tomorrow</strong> (${longDate(deadline)}).</p>`
          : `<p style="${p}">You have <strong>${daysLeft} days</strong> left — the link closes on ${longDate(deadline)}.</p>`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Your assessment link is still open.
    </div>
    ${header}

    <p style="${p}">Hi ${greeting},</p>

    <p style="${p}">
      Just a quick nudge — we haven't seen you start the assessment for the
      <strong>${roleName}</strong> role at <strong>${brandName}</strong> yet, and your link is still open.
    </p>

    ${timeLine}

    <p style="${p}">
      It takes about an hour, and you can use AI tools for the coding part. If now isn't a good time,
      there's nothing to reply to — just come back when it suits.
    </p>

    <div style="margin:26px 0;">
      <a href="${link}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:8px;font-size:15px;">
        Start your assessment &rarr;
      </a>
    </div>

    <p style="${p}">
      The full details are in our original email. If anything's in the way — a technical problem, or
      the timing — just reply and a person will help.
    </p>

    <p style="font-size:12px;color:#888;line-height:1.6;margin-top:22px;">
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
    ${devSimulateHeader()}
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
 * Grant notification — an admin enabled something on the candidate's assessment
 * (a defence retry, typed answers, etc.). ONE template with a variable action
 * line; the email is a nudge, the dashboard is the source of truth. Carries no
 * evaluation data.
 */
export function grantEmail(opts: {
  candidateName: string | null;
  companyName?: string | null;
  roleName?: string | null;
  /** Plain-language statement of what was enabled. */
  actionLine: string;
  resumeLink: string;
  deadline?: Date | null;
}): { subject: string; html: string } {
  const { candidateName, companyName, roleName, actionLine, resumeLink, deadline } = opts;
  const greeting = candidateName?.trim() ? candidateName.trim().split(" ")[0] : "there";
  const roleBit = roleName && companyName ? ` for the ${roleName} assessment at ${companyName}` : "";
  const subject = "One step remaining on your DevSimulate assessment";

  const deadlineLine = deadline
    ? `<p style="font-size:13px;color:#666;line-height:1.6;">Please complete it by <strong>${deadline.toDateString()}</strong>.</p>`
    : "";

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a;">
    ${devSimulateHeader()}
    <h1 style="font-size:22px;margin:0 0 16px;">You have one step remaining</h1>
    <p style="font-size:15px;line-height:1.6;color:#333;">
      Hi ${greeting},<br><br>
      ${actionLine}${roleBit ? ` — ${roleBit.trim()}` : ""}. You can pick up right where you left off.
    </p>
    <div style="margin:24px 0;">
      <a href="${resumeLink}" style="display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;font-size:14px;">
        Continue your assessment →
      </a>
    </div>
    ${deadlineLine}
    <p style="font-size:12px;color:#888;line-height:1.6;">
      If the button doesn't work, paste this into your browser:<br>
      <span style="color:#aaa;word-break:break-all;">${resumeLink}</span>
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
    ${devSimulateHeader()}
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

/**
 * Builds the rejection email for a candidate the employer has passed on.
 * Respectful about the decision itself — but a rejection isn't a dead end:
 * if a final score was recorded, it's included, and if it cleared the
 * certificate threshold, the certificate link is too. No flags or advisory
 * signals are ever mentioned, only the score they can already see.
 */
export function rejectionEmail(opts: {
  candidateName: string;
  companyName: string;
  roleName: string;
  score?: number | null;
  certificateUrl?: string | null;
  /** Address a "request human review" reply is directed to. */
  reviewEmail?: string | null;
  /** Last day the candidate can appeal their result (7 days out by default). */
  appealDeadline?: Date | null;
}): { subject: string; html: string } {
  const { candidateName, companyName, roleName, score, certificateUrl, reviewEmail, appealDeadline } = opts;
  const subject = `Your DevSimulate results — ${roleName} at ${companyName}`;

  const scoreBlock = score != null
    ? `<div style="margin:20px 0;padding:16px 20px;background:#f7f7f8;border-radius:8px;">
         <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.04em;">Your score</div>
         <div style="font-size:28px;font-weight:800;color:#1a1a1a;">${score}<span style="font-size:14px;font-weight:400;color:#888;"> / 100</span></div>
       </div>`
    : "";

  const certBlock = certificateUrl
    ? `<div style="margin:20px 0;">
         <a href="${certificateUrl}" style="display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;font-size:14px;">View your certificate →</a>
         <p style="font-size:13px;color:#888;line-height:1.6;margin-top:10px;">It&rsquo;s yours to keep — share it on LinkedIn or anywhere proof of your ability matters.</p>
       </div>`
    : "";

  // The candidate has no result page, so this email is the one place they can
  // ask for a human to re-check their result — within the appeal window.
  const reviewBlock = reviewEmail
    ? `<div style="margin:20px 0;padding:14px 18px;border:1px solid #eee;border-radius:8px;">
         <p style="font-size:13px;color:#555;line-height:1.6;margin:0;">
           Think your result doesn&rsquo;t reflect your work?
           <a href="mailto:${reviewEmail}?subject=${encodeURIComponent(`Review request — ${roleName} at ${companyName}`)}" style="color:#4F46E5;text-decoration:none;font-weight:600;">Request a human review</a>${
             appealDeadline
               ? ` by <strong>${appealDeadline.toDateString()}</strong>.`
               : "."
           }
         </p>
       </div>`
    : "";

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a;">
    ${devSimulateHeader()}
    <h1 style="font-size:22px;margin:0 0 16px;">Thanks for putting in the work</h1>
    <p style="font-size:15px;line-height:1.6;color:#333;">
      Hi ${candidateName},<br><br>
      Diagnosing a real bug under a timer and then defending your reasoning out loud isn&rsquo;t
      easy — thank you for seeing the <strong>${roleName}</strong> assessment for
      <strong>${companyName}</strong> all the way through. Here&rsquo;s what you earned:
    </p>
    ${scoreBlock}
    ${certBlock}
    <p style="font-size:15px;line-height:1.6;color:#333;">
      After careful review, ${companyName}&rsquo;s team has decided to move forward with other
      candidates for this particular role. That&rsquo;s about fit for this one opening, not a
      verdict on your ability — the score and certificate above are real, and they&rsquo;re yours.
    </p>
    <p style="font-size:15px;line-height:1.6;color:#333;">
      We&rsquo;d love to see you take on another ticket on DevSimulate whenever you&rsquo;re ready —
      every assessment sharpens the same skills, and the next one could be the one that lands.
    </p>
    ${reviewBlock}
    <p style="font-size:13px;color:#888;line-height:1.6;">
      — The ${companyName} Hiring Team
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="font-size:12px;color:#aaa;">Sent via DevSimulate on behalf of ${companyName}.</p>
  </div>`;

  return { subject, html };
}
