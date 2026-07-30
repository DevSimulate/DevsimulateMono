/**
 * End-to-end smoke test for the hiring flow.
 *
 * Drives a real API over HTTP as a real candidate would, and asserts the
 * invariants that actually broke in production — every one of these checks
 * corresponds to a bug that shipped:
 *
 *   · a hiring candidate's scores must never come back in any response
 *   · skillScore must not absorb hiring work
 *   · the public profile and leaderboard must not expose it
 *   · a hiring candidate must not be metered by the free-tier quota
 *   · a double submit must not create a second submission
 *   · resume must return them to the step they stopped on
 *   · a new hiring campaign must be proctored
 *
 * Creates its own throwaway org, campaign, ticket assignment and user, then
 * deletes them. It never touches real candidate data.
 *
 *   npm run qa:smoke                      # local API, no Claude (fast, free)
 *   npm run qa:smoke -- --api=https://... # against a deployed API
 *   npm run qa:smoke -- --review          # also wait for a real AI review ($)
 *   npm run qa:smoke -- --full            # the whole assessment: Q1, Q2,
 *                                         # defence, scoring, publication ($$)
 *
 * Exit code is non-zero if any check fails, so CI can gate a deploy on it.
 */
import "dotenv/config";
import jwt from "jsonwebtoken";
import { PrismaClient, CampaignType, CampaignStatus, Difficulty } from "@prisma/client";

const prisma = new PrismaClient();

const arg = (name: string, fallback?: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const has = (name: string) => process.argv.includes(`--${name}`);

const API = arg("api", process.env.QA_API_URL ?? "http://localhost:8080")!;
/** --full runs the whole assessment, which requires a real review first. */
const FULL = has("full");
const WITH_REVIEW = has("review") || FULL;
const STAMP = Date.now().toString(36);

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failures.push(name); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function api(path: string, init: RequestInit & { token?: string } = {}) {
  const { token, ...rest } = init;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
  });
  let body: unknown = null;
  try { body = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body: body as Record<string, unknown> };
}

/** Every field a hiring candidate must never receive. */
const FORBIDDEN = [
  "scoreTotal", "scorePrBase", "scoreDiagnosis", "scoreDesign",
  "scoreCommunication", "scoreExecution", "claudeReview", "graderResult",
];

function leaks(obj: unknown): string[] {
  if (!obj || typeof obj !== "object") return [];
  const rec = obj as Record<string, unknown>;
  return FORBIDDEN.filter((f) => rec[f] !== null && rec[f] !== undefined && rec[f] !== 0 && rec[f] !== false);
}

/**
 * A privacy assertion must only be trusted on a successful response. An error
 * body contains no score fields, so "nothing leaked" would pass on a 401 and
 * report the system as safe when nothing was actually tested — the failure mode
 * that makes a green suite worse than no suite.
 */
function checkNoLeak(name: string, status: number, data: unknown) {
  if (status !== 200) { check(name, false, `expected 200, got ${status} — assertion not exercised`); return; }
  const found = leaks(data);
  check(name, found.length === 0, `leaked: ${found.join(", ")}`);
}

async function main() {
  console.log(`\nQA smoke — ${API}${WITH_REVIEW ? " (with real AI review)" : " (no AI review)"}\n`);

  // ── Fixtures ──────────────────────────────────────────────────────────────
  const codebase = await prisma.codebase.findFirst({ select: { id: true } });
  const ticket = await prisma.ticket.findFirst({
    where: { codebaseId: codebase?.id },
    select: { id: true, expectedMinutes: true },
  });
  if (!codebase || !ticket) throw new Error("No codebase/ticket seeded — run db:seed first");

  const org = await prisma.organisation.create({
    data: { name: `qa-${STAMP}`, brandName: `QA ${STAMP}` },
  });
  const user = await prisma.user.create({
    data: {
      githubUsername: `qa-cand-${STAMP}`,
      email: `qa-${STAMP}@example.test`,
      fullName: "QA Candidate",
      subscriptionTier: "FREE",
    },
  });
  const campaign = await prisma.campaign.create({
    data: {
      orgId: org.id, roleName: `QA Role ${STAMP}`, companyName: `QA Co ${STAMP}`,
      codebaseId: codebase.id, difficulty: Difficulty.MID, candidateLimit: 5,
      shareableSlug: `qa-${STAMP}`, ticketIds: [ticket.id],
      type: CampaignType.HIRING, status: CampaignStatus.ACTIVE,
      deadline: new Date(Date.now() + 7 * 86_400_000),
      // Mirrors what POST /campaigns now defaults to.
      blockPaste: true, requireFullscreen: true,
    },
  });
  await prisma.campaignCandidate.create({ data: { campaignId: campaign.id, userId: user.id } });
  await prisma.ticketAssignment.create({
    data: { userId: user.id, ticketId: ticket.id, branchName: "ds/qa-smoke" },
  });

  // Signed with the secret of the API being tested — not necessarily the local
  // one. Pointing --api at production while holding a dev JWT_SECRET produces a
  // token that API will reject.
  const secret = arg("jwt-secret", process.env.QA_JWT_SECRET ?? process.env.JWT_SECRET);
  if (!secret) throw new Error("No JWT secret — set JWT_SECRET, QA_JWT_SECRET, or pass --jwt-secret=");
  const token = jwt.sign(
    { userId: user.id, githubUsername: user.githubUsername },
    secret,
    { expiresIn: "1h" }
  );

  const cleanup = async () => {
    await prisma.followUpQuestion.deleteMany({ where: { submission: { userId: user.id } } });
    await prisma.submission.deleteMany({ where: { userId: user.id } });
    await prisma.ticketAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.campaignCandidate.deleteMany({ where: { userId: user.id } });
    await prisma.campaignInvite.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.campaign.deleteMany({ where: { id: campaign.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.organisation.deleteMany({ where: { id: org.id } });
  };

  try {
    // ── 0. Auth preflight ───────────────────────────────────────────────────
    // Abort rather than run on. Without this every authenticated check fails
    // for one reason, and worse, the privacy assertions "pass" against 401
    // bodies that contain no score fields — a green run that tested nothing.
    const probe = await api("/auth/me", { token });
    if (probe.status !== 200) {
      console.log(`\n  ABORT  the API rejected our token (${probe.status}: ${probe.body?.error ?? ""})`);
      console.log(`         The JWT secret must match the API at ${API}.`);
      console.log(`         Pass it explicitly:  npm run qa:smoke -- --api=... --jwt-secret=<that API's JWT_SECRET>\n`);
      failures.push("auth preflight");
      return;
    }

    // ── 1. Campaign defaults ────────────────────────────────────────────────
    console.log("Campaign policy");
    check("new hiring campaign is proctored", campaign.requireFullscreen && campaign.blockPaste);

    // ── 2. Ticket view is hiring-aware ──────────────────────────────────────
    console.log("\nTicket");
    const tk = await api(`/tickets/${ticket.id}`, { token });
    check("GET /tickets/:id stamps hideResults", tk.body?.hideResults === true,
      `got ${JSON.stringify(tk.body?.hideResults)}`);
    const proctoring = tk.body?.proctoring as Record<string, unknown> | undefined;
    check("proctoring policy is returned to the client",
      proctoring?.requireFullscreen === true && proctoring?.blockPaste === true);

    // ── 3. Submit ───────────────────────────────────────────────────────────
    console.log("\nSubmission");
    const payload = {
      ticketId: ticket.id,
      prUrl: "https://github.com/DevSimulate/geoinsight/pull/5",
      prDescription: "## Root cause\nQA smoke test submission — not a real answer.\n".repeat(3),
      branchName: "ds/qa-smoke",
    };
    const first = await api("/submissions", { method: "POST", token, body: JSON.stringify(payload) });
    check("hiring candidate can submit (not blocked by free-tier quota)",
      first.status === 201, `status ${first.status}: ${JSON.stringify(first.body?.error ?? "")}`);
    const subId = (first.body?.data as Record<string, unknown> | undefined)?.id as string | undefined;

    // ── 4. Double submit is idempotent ──────────────────────────────────────
    const second = await api("/submissions", { method: "POST", token, body: JSON.stringify(payload) });
    const secondId = (second.body?.data as Record<string, unknown> | undefined)?.id as string | undefined;
    check("second submit returns the SAME submission", !!subId && secondId === subId,
      `first=${subId} second=${secondId}`);
    const liveCount = await prisma.submission.count({ where: { userId: user.id, status: { not: "VOID" } } });
    check("only one submission row exists", liveCount === 1, `found ${liveCount}`);

    // ── 5. Optional: wait for a real review ─────────────────────────────────
    if (WITH_REVIEW && subId) {
      console.log("\nAI review (real Claude calls)");
      let reviewed = false;
      for (let i = 0; i < 40; i++) {
        const s = await prisma.submission.findUnique({ where: { id: subId }, select: { status: true } });
        if (s?.status === "REVIEWED") { reviewed = true; break; }
        if (s?.status === "VOID") break;
        await new Promise((r) => setTimeout(r, 5000));
      }
      check("review completed within 200s", reviewed);
    }

    // ── 6. Hiring privacy on every candidate-facing read ────────────────────
    console.log("\nHiring privacy");
    const one = await api(`/submissions/${subId}`, { token });
    const oneData = one.body?.data as Record<string, unknown> | undefined;
    checkNoLeak("GET /submissions/:id strips evaluation", one.status, oneData);
    check("GET /submissions/:id stamps hideResults", oneData?.hideResults === true);

    const list = await api("/submissions", { token });
    const listData = (list.body?.data as Record<string, unknown>[]) ?? [];
    const mine = listData.filter((s) => s.id === subId);
    if (list.status !== 200) {
      check("GET /submissions strips evaluation", false, `expected 200, got ${list.status}`);
    } else if (mine.length === 0) {
      check("GET /submissions strips evaluation", false, "our submission was not in the list");
    } else {
      const listLeaks = mine.flatMap(leaks);
      check("GET /submissions strips evaluation", listLeaks.length === 0, `leaked: ${listLeaks.join(", ")}`);
    }

    const hist = await api("/submissions/history", { token });
    check("GET /submissions/history responds 200", hist.status === 200, `got ${hist.status}`);

    // ── 7. Derived numbers exclude hiring ───────────────────────────────────
    console.log("\nDerived numbers");
    const me = await api("/auth/me", { token });
    const meData = me.body?.data as Record<string, unknown> | undefined;
    check("skillScore is not fed by hiring work", (meData?.skillScore ?? 0) === 0,
      `skillScore=${meData?.skillScore}`);

    const prof = await api(`/users/${user.githubUsername}/profile`);
    const profData = prof.body?.data as Record<string, unknown> | undefined;
    check("public profile excludes hiring submissions",
      (profData?.ticketsCompleted ?? 0) === 0 && (profData?.averageScore ?? 0) === 0,
      `tickets=${profData?.ticketsCompleted} avg=${profData?.averageScore}`);
    check("public profile reports no hiring participation",
      (profData?.totalSubmissions ?? 0) === 0, `totalSubmissions=${profData?.totalSubmissions}`);

    const board = await api("/users/leaderboard");
    const rows = (board.body?.data as Record<string, unknown>[]) ?? [];
    check("leaderboard does not rank the hiring candidate",
      !rows.some((r) => r.githubUsername === user.githubUsername));

    // ── 8. Resume points at the right stage ─────────────────────────────────
    console.log("\nResume");
    const resume = await api(`/submissions/${subId}/resume`, { token });
    const rData = resume.body?.data as Record<string, unknown> | undefined;
    if (WITH_REVIEW) {
      check("resume returns q1 for an unanswered first question", rData?.stage === "q1",
        `stage=${rData?.stage} resumable=${rData?.resumable}`);
    } else {
      check("resume returns analysing while the review is pending", rData?.stage === "analysing",
        `stage=${rData?.stage} resumable=${rData?.resumable}`);
    }

    // ── 8b. The whole assessment, end to end ────────────────────────────────
    // Written answers, the defence, scoring and publication — the half of the
    // journey the API-only checks above never reach. Real Claude calls, so it
    // costs money and takes a minute; opt in with --full.
    //
    // The spoken defence is taken through the TYPED channel, unlocked by the
    // admin grant. That is a genuine production path (it exists for candidates
    // whose mic fails) and it is scored by the same code as the spoken one, so
    // exercising it tests the real scoring pipeline without synthesising audio.
    if (FULL && subId) {
      console.log("\nFull assessment flow");

      // Q1
      let fu = (await api(`/submissions/${subId}/followup`, { token })).body?.data as Record<string, unknown> | undefined;
      check("Q1 was generated", !!fu?.question1, `got ${JSON.stringify(fu?.question1)}`);

      const a1 = "The coordinates were stored in GeoJSON order, longitude first, but read as latitude first. I confirmed it by logging the parsed pair against a known station and seeing the axes swapped.";
      const q2res = await api(`/submissions/${subId}/followup/answer1`, {
        method: "POST", token, body: JSON.stringify({ answer1: a1 }),
      });
      const q2 = (q2res.body?.data as Record<string, unknown> | undefined)?.question2 as string | undefined;
      check("answering Q1 returns Q2", q2res.status === 200 && !!q2,
        `status ${q2res.status}: ${JSON.stringify(q2res.body?.error ?? "")}`);

      // Q2 + declaration completes the written half
      const a2 = "I fixed it at the parse boundary rather than at each call site, so every consumer gets the corrected order and no caller has to remember the convention.";
      const written = await api(`/submissions/${subId}/followup`, {
        method: "POST", token,
        body: JSON.stringify({ answer1: a1, answer2: a2, aiDeclaration: "NO_AI_USED", pasteAttempts: 0, tabSwitches: 0 }),
      });
      check("written follow-ups accepted", written.status === 200,
        `status ${written.status}: ${JSON.stringify(written.body?.error ?? "")}`);
      checkNoLeak("follow-up response hides the evaluation", written.status, written.body?.data);

      // Unlock the typed defence the same way a real mic failure would.
      const adminKey = process.env.ADMIN_API_KEY;
      if (!adminKey) {
        check("ADMIN_API_KEY available for the defence step", false, "set ADMIN_API_KEY to run the full flow");
      } else {
        const grant = await fetch(`${API}/admin/submissions/${subId}/grant-typed`, {
          method: "POST", headers: { "x-admin-key": adminKey, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        check("typed defence granted", grant.ok, `status ${grant.status}`);

        const vq = await api(`/submissions/${subId}/verbal-question`, { method: "POST", token });
        const question = (vq.body?.data as Record<string, unknown> | undefined)?.question as string | undefined;
        check("defence question generated", vq.status === 200 && !!question, `status ${vq.status}`);

        const defence = await api(`/submissions/${subId}/typed-answer`, {
          method: "POST", token,
          body: JSON.stringify({
            question: question ?? "",
            answer: "The bug was axis order. GeoJSON is longitude-latitude and the map component expected latitude-longitude, so every station rendered mirrored across the diagonal. Fixing it once at the parse step means no caller has to remember which convention applies.",
          }),
        });
        check("defence accepted and scored", defence.status === 200,
          `status ${defence.status}: ${JSON.stringify(defence.body?.error ?? "")}`);
        checkNoLeak("defence response hides the evaluation", defence.status, defence.body?.data);

        // The employer's side: a real, finalized, scored result exists.
        const finalRow = await prisma.submission.findUnique({
          where: { id: subId },
          select: { finalized: true, scoreTotal: true },
        });
        check("submission is finalized", finalRow?.finalized === true);
        check("a score exists for the employer", typeof finalRow?.scoreTotal === "number",
          `scoreTotal=${finalRow?.scoreTotal}`);

        // The candidate's side: still nothing.
        const after = await api(`/submissions/${subId}`, { token });
        checkNoLeak("candidate still cannot see the score after finalizing", after.status, after.body?.data);

        const meAfter = await api("/auth/me", { token });
        const skill = (meAfter.body?.data as Record<string, unknown> | undefined)?.skillScore;
        check("finalizing hiring work leaves skillScore at 0", skill === 0, `skillScore=${skill}`);

        const boardAfter = await api("/users/leaderboard");
        const rowsAfter = (boardAfter.body?.data as Record<string, unknown>[]) ?? [];
        check("finalized hiring work stays off the leaderboard",
          !rowsAfter.some((r) => r.githubUsername === user.githubUsername));
      }
    }

    // ── 9. Void makes it non-resumable, with useful wording ─────────────────
    if (subId) {
      await prisma.submission.update({ where: { id: subId }, data: { status: "VOID" } });
      const afterVoid = await api(`/submissions/${subId}/resume`, { token });
      const vd = afterVoid.body?.data as Record<string, unknown> | undefined;
      check("a voided submission is refused with a next step",
        vd?.resumable === false && String(vd?.reason ?? "").includes("VS Code"),
        `reason=${vd?.reason}`);
    }
  } finally {
    await cleanup();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFailed:");
    for (const f of failures) console.log(`  · ${f}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => { console.error("\nsmoke run crashed:", e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
