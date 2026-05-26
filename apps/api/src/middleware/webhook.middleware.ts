import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

/**
 * Verifies that the incoming request originated from GitHub by checking
 * the X-Hub-Signature-256 header using HMAC-SHA256.
 *
 * Must be mounted BEFORE express.json() so the raw body is still available.
 */
export function verifyGitHubWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    res.status(500).json({ error: "GITHUB_WEBHOOK_SECRET is not configured" });
    return;
  }

  const signature = req.headers["x-hub-signature-256"] as string | undefined;

  if (!signature) {
    res.status(401).json({ error: "Missing X-Hub-Signature-256 header" });
    return;
  }

  // req.body at this point is the raw Buffer (see index.ts bodyParser config)
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!rawBody) {
    res.status(400).json({ error: "Unable to read raw request body for signature verification" });
    return;
  }

  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

  const trusted = Buffer.from(expected, "utf8");
  const received = Buffer.from(signature, "utf8");

  // Constant-time comparison to prevent timing attacks
  if (
    trusted.length !== received.length ||
    !crypto.timingSafeEqual(trusted, received)
  ) {
    res.status(401).json({ error: "Webhook signature verification failed" });
    return;
  }

  next();
}
