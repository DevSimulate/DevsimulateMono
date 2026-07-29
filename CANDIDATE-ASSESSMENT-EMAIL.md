# Candidate assessment invite — LMKR (sample)

Filled-in sample of the hiring assessment invite, using LMKR / Full Stack
Developer (.NET + Angular) as the example campaign.

Every rule below is checked against the real behaviour in
`apps/web/src/app/submit/page.tsx` — the stage list, the four write-up sections,
the paste policy and the leave-guard thresholds all match the code as shipped. If
those change, this copy changes with them.

**Field mapping** (what gets substituted per campaign when this is wired into
`assessmentInviteEmail` in `apps/api/src/lib/email.ts`):

| Placeholder | Value in this sample | Source |
|---|---|---|
| `{{brandName}}` | LMKR | `Campaign.companyName` |
| `{{roleName}}` | Full Stack Developer (.NET + Angular) | `Campaign.roleName` |
| `{{deadline}}` | Tuesday, 11 August 2026 | `Campaign.deadline` |
| `{{expectedMinutes}}` | 60 | `Ticket.expectedMinutes` (default 60) |
| `{{candidateName}}` | Sahibzada Abdullah | `CampaignCandidate` → `User.fullName` |
| `{{link}}` | sample below | generated per candidate, single-use |
| `{{supportEmail}}` | ossama@devsimulate.com | `REVIEW_CONTACT_EMAIL` |

---

**Subject:** Your technical assessment — Full Stack Developer (.NET + Angular) at LMKR

**Preheader:** You may use AI to write the fix. You'll be asked to explain it without one.

---

Hi Sahibzada,

As the next step for the **Full Stack Developer (.NET + Angular)** role at
**LMKR**, we'd like you to complete a hands-on assessment. You'll diagnose and fix
a real issue in a working codebase — no quizzes, no whiteboard puzzles, no trick
questions.

Please read this email fully before you begin. The assessment has two phases, and
the second one cannot be paused or restarted.

---

## Phase 1 — Fix the code (AI allowed, no time pressure)

Work in your own editor, at your own pace, however you normally work.

**You may use AI tools — Copilot, Claude, ChatGPT, whatever you use day to day.**
We're not testing whether you can code without help. We're testing whether you
understand what you shipped. That's the job.

Use as much AI as you like here. There is no monitoring during this phase.

## Phase 2 — Explain it (no AI, no going back)

When you open the assessment, your browser enters fullscreen and the monitored
portion begins. From that point on you cannot return to your code, your editor,
your notes, or any AI tool.

This is the whole point of the exercise. Because we let you use AI to build the
fix, we ask you to defend it on your own. If you understand your own change, this
part is straightforward.

**Do not open the assessment until you can explain your fix from memory.**

---

## Before you start — a readiness check

Open the assessment only when you can answer all four of these without looking
anything up. They are, in order, exactly what the assessment asks you to write:

1. **Root cause** — what was actually broken, and why? The specific cause, not the symptom.
2. **How you found it** — what you read, ran or tested to confirm it.
3. **Why this fix** — why this approach over the alternatives, and what trade-off you accepted.
4. **How you verified it** — what you ran or observed that proves it works now.

After the write-up you'll answer **two follow-up questions** about your own
change, then give a **short spoken explanation** with your camera and microphone
on. All of it is about the code you just wrote.

Practical setup, before you click the link:

- A quiet space, roughly **60 minutes** uninterrupted
- A working **microphone and camera** (there's a mic check before the spoken step — please run it)
- **Chrome or Edge** on a desktop or laptop; close other apps and any second monitor
- A stable connection

---

## How to navigate the system

**1. Install the DevSimulate extension for VS Code** and sign in with GitHub.

**2. Open your ticket.** Your assigned ticket appears in the DevSimulate sidebar
with the description and the files worth investigating.

**3. Click "Fork & Clone".** This forks the repository to your GitHub account and
clones it locally. Work only in that clone.

**4. Fix the issue.** Take the time you need. Use AI freely.

**5. Click "Push & Create PR"** when you're happy with the fix. This pushes your
branch and opens a pull request against your fork.

**6. Click "Submit PR for Review"** — then stop and re-read the four questions
above. This is the last moment you can go back to your code.

**7. Complete the assessment in your browser.** Fullscreen begins here: the
write-up, the two follow-up questions, then the spoken explanation.

---

## Rules during the monitored phase

We'd rather tell you these plainly up front than have you discover them mid-flow:

- **Fullscreen is required.** Leaving the assessment — switching apps, switching
  tabs, or exiting fullscreen — is recorded. You'll get **two warnings. A third
  leave ends the assessment and voids your submission.**
- **Pasting into the answer fields is disabled.** If you try, you'll get a
  warning. Repeated attempts are flagged for a human to look at, but they will
  **not** end your assessment — we know Ctrl+V is muscle memory.
- **Your camera is on** during the spoken explanation, for presence only.
- **If your microphone fails**, don't panic and don't close the tab. You'll be
  offered a retry or a typed alternative, and you can pick up where you left off.

Nothing here is designed to catch you out. It exists so that everyone's
explanation is genuinely their own.

---

## What happens next

When you finish you'll see a confirmation that your assessment was submitted.

**You won't see a score.** Results go to the LMKR hiring team, who will review
them alongside the rest of your application and contact you by email either way.
Please don't read the absence of a score as a bad sign — no candidate sees one.

Please complete the assessment by **Tuesday, 11 August 2026**. Your link stops
working after that date.

---

## Your data

By starting this assessment you agree that LMKR and DevSimulate may **store your
submission — your code, written answers, and the recording and transcript of your
spoken explanation — and use it to evaluate you for this role and for future roles
you may be a fit for.**

You can ask us to delete it at any time by replying to this email or writing to
ossama@devsimulate.com. Deleting it won't affect any application already in
progress.

If you'd prefer we didn't retain your assessment, reply before you begin and we'll
arrange an alternative.

---

<p align="center"><strong>[ Start your assessment → ](https://app.devsimulate.com/a/lmkr-fsd-7f3c9a)</strong></p>

This link is personal to you — please don't share it.

Questions, or something went wrong? Reply to this email or write to
ossama@devsimulate.com and a person will get back to you.

Good luck — we're looking forward to reading your explanation.

— The LMKR team

*Sent via DevSimulate on behalf of LMKR.*
