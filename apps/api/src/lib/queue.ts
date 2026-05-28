import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { ReviewJobData } from "../types/index";
import { reviewPullRequest, fetchPrDiff, generateFirstQuestion } from "../services/review.service";
import { saveReviewResult, calculateRiskScore } from "../services/score.service";
import prisma from "./prisma";

const QUEUE_NAME = "pr-review";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// Single shared Redis connection used by both Queue and Worker.
// BullMQ requires maxRetriesPerRequest: null for blocking commands.
// Upstash (and other TLS Redis providers) use rediss:// — add tls option automatically.
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
 * Each job: fetches the diff from GitHub, calls Claude, saves the result.
 */
export function startReviewWorker(): Worker<ReviewJobData> {
  const worker = new Worker<ReviewJobData>(
    QUEUE_NAME,
    async (job: Job<ReviewJobData>) => {
      const {
        submissionId,
        prDescription,
        branchName,
        ticketId,
        repoOwner,
        repoName,
        prNumber,
        prUrl,
      } = job.data;

      // Load ticket + codebase for the review prompt
      const ticket = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticketId },
        include: { codebase: true },
      });

      const prDiff = await fetchPrDiff(repoOwner, repoName, prNumber);
      const review = await reviewPullRequest(ticket, prDiff, prDescription);

      // Persist risk score before saving the full review
      const submission = await prisma.submission.findUniqueOrThrow({
        where: { id: submissionId },
      });

      const riskScore = calculateRiskScore(
        prDescription,
        submission.submittedAt,
        ticket.expectedMinutes
      );

      await prisma.submission.update({
        where: { id: submissionId },
        data: { riskScore },
      });

      await saveReviewResult(submissionId, review);

      // Generate Q1 only — Q2 is generated after the developer submits A1
      try {
        const { question1 } = await generateFirstQuestion(ticket, prDiff, review);
        await prisma.followUpQuestion.create({
          data: {
            submissionId,
            question1,
            // question2 left null — generated from A1 in POST /followup/answer1
          },
        });
        console.log(`[review-worker] Q1 generated for submission ${submissionId}`);
      } catch (err) {
        console.error(`[review-worker] Failed to generate Q1:`, err);
      }

      console.log(
        `[review-worker] Completed review for submission ${submissionId} — score ${review.scoreTotal}`
      );
    },
    { connection: redisConnection, concurrency: 3 }
  );

  worker.on("failed", (job, err) => {
    console.error(
      `[review-worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`,
      err.message
    );
  });

  return worker;
}
