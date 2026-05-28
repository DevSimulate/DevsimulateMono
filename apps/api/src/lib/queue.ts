import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { ReviewJobData } from "../types/index";
import { reviewPullRequest, fetchPrDiff, generateFirstQuestion } from "../services/review.service";
import { saveReviewResult, calculateRiskScore } from "../services/score.service";
import { reviewEvents } from "./review-events";
import prisma from "./prisma";

const QUEUE_NAME = "pr-review";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  ...(REDIS_URL.startsWith("rediss://") ? { tls: {} } : {}),
});

export const reviewQueue = new Queue<ReviewJobData>(QUEUE_NAME, {
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
export function startReviewWorker(): Worker<ReviewJobData> {
  const worker = new Worker<ReviewJobData>(
    QUEUE_NAME,
    async (job: Job<ReviewJobData>) => {
      const { submissionId, prDescription, ticketId, repoOwner, repoName, prNumber } = job.data;

      // ── 1. Fetch ticket and diff in parallel ──────────────────────────────
      const [ticket, prDiff] = await Promise.all([
        prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { codebase: true } }),
        fetchPrDiff(repoOwner, repoName, prNumber),
      ]);

      // ── 2. Run Claude PR review ───────────────────────────────────────────
      const review = await reviewPullRequest(ticket, prDiff, prDescription);

      // ── 3. Compute risk score (synchronous) ──────────────────────────────
      const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
      const riskScore = calculateRiskScore(prDescription, submission.submittedAt, ticket.expectedMinutes);
      await prisma.submission.update({ where: { id: submissionId }, data: { riskScore } });

      // ── 4. Save review result + generate Q1 in parallel ──────────────────
      const [, q1Result] = await Promise.allSettled([
        saveReviewResult(submissionId, review),
        generateFirstQuestion(ticket, prDiff, review),
      ]);

      // ── 5. Persist Q1 if generation succeeded ────────────────────────────
      if (q1Result.status === "fulfilled") {
        await prisma.followUpQuestion.create({
          data: {
            submissionId,
            question1: q1Result.value.question1,
            question2: "",   // populated later when user submits A1
          },
        });
        console.log(`[review-worker] Completed submission ${submissionId} — score ${review.scoreTotal}`);
      } else {
        console.error(`[review-worker] Q1 generation failed for ${submissionId}:`, q1Result.reason);
      }

      // ── 6. Notify SSE clients only after Q1 is saved ─────────────────────
      reviewEvents.emit("reviewed", submissionId);
    },
    { connection: redisConnection, concurrency: 3 }
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
