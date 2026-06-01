import { Router, Request, Response } from "express";
import crypto from "crypto";
import {
  exchangeGitHubCode,
  upsertUserFromGitHub,
  signJwt,
} from "../services/auth.service";
import { requireAuth } from "../middleware/auth.middleware";
import { AuthenticatedRequest } from "../types/index";
import prisma from "../lib/prisma";

// In-memory one-time tokens for the VS Code deep-link auth flow (TTL: 5 min)
const vscodeLinkTokens = new Map<string, { userId: string; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of vscodeLinkTokens) {
    if (v.expiresAt < now) vscodeLinkTokens.delete(k);
  }
}, 60_000);

const router = Router();

/**
 * POST /auth/github
 * Body: { code: string }
 *
 * Exchanges a GitHub OAuth code for a JWT. Creates the user if first login.
 */
router.post("/github", async (req: Request, res: Response): Promise<void> => {
  const { code } = req.body as { code?: string };

  if (!code) {
    res.status(400).json({ error: "Missing required field: code" });
    return;
  }

  try {
    const { githubUser } = await exchangeGitHubCode(code);
    const user = await upsertUserFromGitHub(githubUser);
    const token = signJwt(user);

    res.json({
      data: { token, user },
      message: "Authentication successful",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Authentication failed";
    console.error("[auth] GitHub OAuth error:", message);
    res.status(401).json({ error: message });
  }
});

/**
 * GET /auth/me
 * Authorization: Bearer <token>
 *
 * Returns the authenticated user's profile.
 */
router.get(
  "/me",
  requireAuth as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthenticatedRequest).user;

    try {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });

      res.json({ data: user });
    } catch {
      res.status(404).json({ error: "User not found" });
    }
  }
);

/**
 * GET /auth/vscode-link-token
 * Authorization: Bearer <jwt>
 *
 * Generates a short-lived one-time token the VS Code extension can exchange
 * for a full JWT. Allows web-session auth to flow into the extension without
 * a second GitHub OAuth round-trip.
 */
router.get(
  "/vscode-link-token",
  requireAuth as (req: Request, res: Response, next: () => void) => void,
  (req: Request, res: Response): void => {
    const { userId } = (req as AuthenticatedRequest).user;
    const linkToken = crypto.randomBytes(32).toString("hex");
    vscodeLinkTokens.set(linkToken, { userId, expiresAt: Date.now() + 5 * 60 * 1000 });
    res.json({ data: { token: linkToken } });
  }
);

/**
 * POST /auth/vscode-exchange
 * Body: { token: string }
 *
 * Exchanges the one-time link token for a full JWT. Single-use and expires in 5 min.
 */
router.post("/vscode-exchange", async (req: Request, res: Response): Promise<void> => {
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }

  const entry = vscodeLinkTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    res.status(401).json({ error: "Invalid or expired token. Please try connecting again." });
    return;
  }

  vscodeLinkTokens.delete(token);

  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: entry.userId } });
    const jwt = signJwt(user);
    res.json({ data: { token: jwt, user } });
  } catch {
    res.status(404).json({ error: "User not found" });
  }
});

export default router;
