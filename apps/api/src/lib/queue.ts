import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { ReviewJobData } from "../types/index";
import {
  reviewPullRequest, fetchPrDiff, generateFirstQuestion,
  reviewSystemDesign, generateFirstQuestionFromDesign,
} from "../services/review.service";
import { saveReviewResult, calculateRiskScore } from "../services/score.service";
import { reviewEvents } from "./review-events";
import prisma from "./prisma";

const QUEUE_NAME = "pr-review";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  ...(REDIS_URL.startsWith("rediss://") ? { tls: {} } : {}),
});

export const reviewQueue = new Queue<ReviewJobData, void, string>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

/**
 * Starts the BullMQ worker that processes PR review jobs.
 *
 * Parallelised in two places:
 *  1. Ticket DB fetch + GitHub diff fetch run simultaneously.
 *  2. saveReviewResult + generateFirstQuestion run simultaneously
 *     (DB write and Claude Q1 call overlap, saving ~3-5 seconds).
 */
export function startReviewWorker(): Worker<ReviewJobData, void, string> {
  const worker = new Worker<ReviewJobData, void, string>(
    QUEUE_NAME,
    async (job: Job<ReviewJobData, void, string>) => {
      const { submissionId, submissionType, ticketId } = job.data;

      const ticket = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticketId },
        include: { codebase: true },
      });

      let review;
      let q1Context: string;

      if (submissionType === "SYSTEM_DESIGN") {
        // ── System design review path ────────────────────────────────────────
        const designDoc = job.data.designDoc ?? "";
        review = await reviewSystemDesign(ticket, designDoc);
        q1Context = designDoc;

        const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
        const riskScore = calculateRiskScore(designDoc, submission.submittedAt, ticket.expectedMinutes);
        await prisma.submission.update({ where: { id: submissionId }, data: { riskScore } });

        const [, q1Result] = await Promise.allSettled([
          saveReviewResult(submissionId, review),
          generateFirstQuestionFromDesign(ticket, q1Context, review),
        ]);

        if (q1Result.status === "fulfilled") {
          await prisma.followUpQuestion.create({
            data: { submissionId, question1: q1Result.value.question1, question2: "" },
          });
          console.log(`[review-worker] SD review done for ${submissionId} — score ${review.scoreTotal}`);
        } else {
          console.error(`[review-worker] Q1 gen failed for ${submissionId}:`, q1Result.reason);
        }
      } else {
        // ── Code review path (original) ──────────────────────────────────────
        const { prDescription = "", repoOwner = "", repoName = "", prNumber = 0 } = job.data;

        const prDiff = await fetchPrDiff(repoOwner, repoName, prNumber);
        review = await reviewPullRequest(ticket, prDiff, prDescription);

        const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
        const riskScore = calculateRiskScore(prDescription, submission.submittedAt, ticket.expectedMinutes);
        await prisma.submission.update({ where: { id: submissionId }, data: { riskScore } });

        const [, q1Result] = await Promise.allSettled([
          saveReviewResult(submissionId, review),
          generateFirstQuestion(ticket, prDiff, review),
        ]);

        if (q1Result.status === "fulfilled") {
          await prisma.followUpQuestion.create({
            data: { submissionId, question1: q1Result.value.question1, question2: "" },
          });
          console.log(`[review-worker] Code review done for ${submissionId} — score ${review.scoreTotal}`);
        } else {
          console.error(`[review-worker] Q1 gen failed for ${submissionId}:`, q1Result.reason);
        }
      }

      // ── Notify SSE clients after Q1 is saved ────────────────────────────
      reviewEvents.emit("reviewed", submissionId);
    },
    {
      connection: redisConnection,
      concurrency: 2,
      drainDelay: 60_000,      // poll empty queue every 60s (default: 5s) — saves ~90% idle requests
      stalledInterval: 300_000, // check stalled jobs every 5 min (default: 30s)
      lockDuration: 600_000,   // 10 min lock — Claude reviews can be slow
    }
  );

  worker.on("failed", async (job, err) => {
    console.error(`[review-worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err.message);
    // Mark submission VOID so the web client stops polling immediately
    if (job?.data?.submissionId) {
      try {
        await prisma.submission.update({
          where: { id: job.data.submissionId },
          data: { status: "VOID" },
        });
        reviewEvents.emit("reviewed", job.data.submissionId); // unblock SSE clients
      } catch { /* best-effort */ }
    }
  });

  return worker;
}
