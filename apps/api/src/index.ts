import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { runSeed } from "./seed";
import cors from "cors";
import helmet from "helmet";
import authRouter from "./routes/auth";
import ticketsRouter from "./routes/tickets";
import submissionsRouter from "./routes/submissions";
import webhooksRouter from "./routes/webhooks";
import usersRouter from "./routes/users";
import billingRouter from "./routes/billing";
import employerRouter from "./routes/employer";
import employerDemoRouter from "./routes/employer-demo";
import campaignsRouter from "./routes/campaigns";
import employerPortalRouter from "./routes/employer-portal";
import githubRouter from "./routes/github";
import waitlistRouter from "./routes/waitlist";
import feedbackRouter from "./routes/feedback";
import { startReviewWorker } from "./lib/queue";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

// ---------------------------------------------------------------------------
// Raw body capture for GitHub webhook signature verification.
// Must run BEFORE express.json() so the raw buffer is preserved.
// ---------------------------------------------------------------------------
app.use(
  (req: Request & { rawBody?: Buffer }, _res: Response, next: NextFunction) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      req.rawBody = Buffer.concat(chunks);
    });
    next();
  }
);

// ---------------------------------------------------------------------------
// Security & parsing
// ---------------------------------------------------------------------------
app.use(helmet());
const ALLOWED_ORIGINS = [
  "https://www.devsimulate.com",
  "https://devsimulate.com",
  "http://localhost:3000",
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use("/auth", authRouter);
app.use("/tickets", ticketsRouter);
app.use("/submissions", submissionsRouter);
app.use("/webhooks", webhooksRouter);
app.use("/users", usersRouter);
app.use("/billing", billingRouter);
app.use("/github", githubRouter);
app.use("/waitlist", waitlistRouter);
app.use("/feedback", feedbackRouter);
app.use("/employer/campaigns", campaignsRouter);
app.use("/employer", employerPortalRouter);
app.use("/", employerDemoRouter);
app.use("/", employerRouter);

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[unhandled-error]", err.message, err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`DevSimulate API running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV ?? "development"}`);
  runSeed().catch((err) => console.error("[seed] failed:", err));
});

// Start background review worker only when Redis is available
if (process.env.REDIS_URL || process.env.NODE_ENV === "production") {
  startReviewWorker();
  console.log("[queue] PR review worker started");
} else {
  // Try to connect; log a single warning if Redis isn't running
  import("ioredis").then(({ default: IORedis }) => {
    const testRedis = new IORedis("redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    testRedis.once("ready", () => {
      testRedis.disconnect();
      startReviewWorker();
      console.log("[queue] PR review worker started");
    });
    testRedis.once("error", () => {
      testRedis.disconnect();
      console.warn("[queue] Redis not available — review worker disabled. Start Redis to enable PR scoring.");
    });
  });
}

export default app;

