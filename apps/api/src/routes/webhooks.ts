import { Router, Request, Response } from "express";
import { verifyGitHubWebhook } from "../middleware/webhook.middleware";
import { reviewQueue } from "../lib/queue";
import { GitHubPullRequestPayload, ReviewJobData } from "../types/index";
import { calculateRiskScore } from "../services/score.service";
import prisma from "../lib/prisma";
import octokit from "../lib/github";

const router = Router();

// Branch name format produced by the extension: ds/ticket-{ticketId8}-{slug}
const BRANCH_PATTERN = /^ds\/ticket-(.+)$/;

/**
 * POST /webhooks/github
 *
 * Receives GitHub pull_request webhook events. Processing steps:
 * 1. Verify HMAC-SHA256 signature (middleware)
 * 2. Ignore events that are not opened/synchronize
 * 3. Extract PR metadata and match branch to a ticket assignment
 * 4. Create Submission with PENDING status
 * 5. Enqueue async Claude review job
 * 6. Return 200 immediately — never block the webhook response
 */
router.post(
  "/github",
  verifyGitHubWebhook,
  async (req: Request, res: Response): Promise<void> => {
    const event = req.headers["x-github-event"] as string;

    // Only process pull_request events
    if (event !== "pull_request") {
      res.status(200).json({ message: `Event ${event} ignored` });
      return;
    }

    const payload = req.body as GitHubPullRequestPayload;

    // Only process PR open, reopen, and synchronize (new commits pushed to PR)
    if (payload.action !== "opened" && payload.action !== "synchronize" && payload.action !== "reopened") {
      res.status(200).json({ message: `Action ${payload.action} ignored` });
      return;
    }

    const pr = payload.pull_request;
    const branchName = pr.head.ref;
    const repoOwner = pr.base.repo.owner.login;
    const repoName = pr.base.repo.name;
    const prNumber = pr.number;
    const prUrl = pr.html_url;
    const prDescription = pr.body ?? "";
    const githubUsername = pr.user.login;

    // Match the branch to a ticket assignment
    const match = BRANCH_PATTERN.exec(branchName);

    if (!match) {
      // Not a DevSimulate branch — ignore gracefully
      res.status(200).json({ message: "Branch not in DevSimulate format, ignored" });
      return;
    }

    // First 8 chars of the branch suffix approximate the seeded ticket ID prefix
    const partialTicketId = match[1].substring(0, 8);

    try {
      // Find the user by GitHub username
      const user = await prisma.user.findUnique({
        where: { githubUsername },
      });

      if (!user) {
        console.warn(`[webhook] No user found for GitHub username: ${githubUsername}`);
        res.status(200).json({ message: "User not found, ignoring" });
        return;
      }

      // Find the ticket assignment matching this branch
      const assignment = await prisma.ticketAssignment.findFirst({
        where: {
          userId: user.id,
          branchName,
        },
        include: { ticket: true },
      });

      // Fallback: try matching by partial ticket id in branch name
      const resolvedAssignment =
        assignment ??
        (await prisma.ticketAssignment.findFirst({
          where: {
            userId: user.id,
            ticketId: { startsWith: partialTicketId },
          },
          include: { ticket: true },
        }));

      if (!resolvedAssignment) {
        console.warn(
          `[webhook] No assignment found for branch ${branchName} / user ${githubUsername}`
        );
        res.status(200).json({ message: "No matching assignment, ignoring" });
        return;
      }

      const ticketId = resolvedAssignment.ticketId;
      const expectedMinutes = resolvedAssignment.ticket.expectedMinutes;

      const riskScore = calculateRiskScore(
        prDescription,
        new Date(),
        expectedMinutes
      );

      // Create the submission record
      const submission = await prisma.submission.create({
        data: {
          userId: user.id,
          ticketId,
          prUrl,
          prDescription,
          branchName,
          status: "PENDING",
          riskScore,
        },
      });

      // Enqueue async review — do NOT await, return 200 immediately
      const jobData: ReviewJobData = {
        submissionId: submission.id,
        submissionType: "CODE",
        prUrl,
        prDescription,
        branchName,
        ticketId,
        repoOwner,
        repoName,
        prNumber,
      };

      await reviewQueue.add("review-pr", jobData, {
        jobId: `review-${submission.id}`,
      });

      console.log(
        `[webhook] Queued review job for submission ${submission.id} (PR #${prNumber})`
      );

      // Close the PR immediately so the candidate's code is never merged into
      // the upstream codebase. Fire-and-forget — never block the 200 response.
      void (async () => {
        try {
          await octokit.issues.createComment({
            owner: repoOwner,
            repo: repoName,
            issue_number: prNumber,
            body: [
              "**DevSimulate — Submission Received ✓**",
              "",
              "Your code has been captured and is queued for review. This PR is being closed automatically to protect the shared codebase — your submission is safe and nothing is lost.",
              "",
              "You'll see your score and feedback in the VS Code sidebar once the review completes.",
            ].join("\n"),
          });
          await octokit.pulls.update({
            owner: repoOwner,
            repo: repoName,
            pull_number: prNumber,
            state: "closed",
          });
          console.log(`[webhook] Closed PR #${prNumber} after capturing submission`);
        } catch (err) {
          console.warn(`[webhook] Could not close PR #${prNumber}:`, err instanceof Error ? err.message : err);
        }
      })();

      res.status(200).json({ message: "Webhook received, review queued" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Webhook processing error";
      console.error("[webhook] Error processing webhook:", message);
      // Always return 200 to GitHub to prevent retries on transient errors
      res.status(200).json({ message: "Webhook received with processing error" });
    }
  }
);

export default router;
