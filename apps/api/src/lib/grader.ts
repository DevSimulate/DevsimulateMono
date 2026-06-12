import axios from "axios";
import crypto from "crypto";

/**
 * Fires a repository_dispatch at the private grader repo so its GitHub Action
 * runs the hidden test for this ticket against the candidate's PR branch, then
 * POSTs the result back to /grader/result. Best-effort and non-blocking — if the
 * dispatch token isn't configured, grading is simply skipped.
 */
export async function triggerHiddenTest(p: {
  repoOwner: string;
  repoName: string;
  branch: string;
  ticketId: string;
  submissionId: string;
}): Promise<void> {
  const token = process.env.GRADER_DISPATCH_TOKEN;
  if (!token) return; // hidden-test grading disabled

  const graderRepo = process.env.GRADER_REPO ?? "DevSimulate/novatech-grader";
  const apiBase =
    process.env.API_PUBLIC_URL ?? "https://devsimulateapi-production.up.railway.app";

  try {
    await axios.post(
      `https://api.github.com/repos/${graderRepo}/dispatches`,
      {
        event_type: "grade",
        client_payload: {
          repo: `${p.repoOwner}/${p.repoName}`,
          ref: p.branch,
          ticketId: p.ticketId,
          submissionId: p.submissionId,
          callbackUrl: `${apiBase}/grader/result`,
        },
      },
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
    );
    console.log(`[grader] dispatched hidden test for submission ${p.submissionId}`);
  } catch (e) {
    console.error("[grader] dispatch failed:", e instanceof Error ? e.message : e);
  }
}

/** HMAC-SHA256 verification of the grader callback (CI signs the exact JSON body). */
export function verifyGraderSignature(rawBody: string, signature?: string | null): boolean {
  const secret = process.env.GRADER_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
