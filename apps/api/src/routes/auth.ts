import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  exchangeGitHubCode,
  upsertUserFromGitHub,
  signJwt,
} from "../services/auth.service";
import { requireAuth } from "../middleware/auth.middleware";
import { AuthenticatedRequest } from "../types/index";
import prisma from "../lib/prisma";

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
    const { githubUser, accessToken } = await exchangeGitHubCode(code);
    const user = await upsertUserFromGitHub(githubUser, accessToken);
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
 * Issues a short-lived signed JWT (5 min) the VS Code extension exchanges
 * for a full session JWT. Uses JWT signing so it survives server restarts.
 */
router.get(
  "/vscode-link-token",
  requireAuth as (req: Request, res: Response, next: () => void) => void,
  (req: Request, res: Response): void => {
    const { userId } = (req as AuthenticatedRequest).user;
    const secret = process.env.JWT_SECRET!;
    const linkToken = jwt.sign({ userId, type: "vscode-link" }, secret, { expiresIn: "5m" });
    res.json({ data: { token: linkToken } });
  }
);

/**
 * POST /auth/vscode-exchange
 * Body: { token: string }
 *
 * Verifies the short-lived link token and returns a full session JWT.
 */
router.post("/vscode-exchange", async (req: Request, res: Response): Promise<void> => {
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET!;
    const payload = jwt.verify(token, secret) as { userId: string; type: string };

    if (payload.type !== "vscode-link") {
      res.status(401).json({ error: "Invalid token type" });
      return;
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: payload.userId } });
    const sessionToken = signJwt(user);
    res.json({ data: { token: sessionToken, user } });
  } catch {
    res.status(401).json({ error: "Invalid or expired token. Please click Connect again." });
  }
});

/**
 * GET /auth/github-token
 * Authorization: Bearer <jwt>
 *
 * Returns the user's stored GitHub access token so the VS Code extension can
 * fork/clone/push without invoking VS Code's own GitHub sign-in. Returns
 * { token: null } if the user authenticated before the `repo` scope was added
 * (they need to sign in again to grant it).
 */
router.get(
  "/github-token",
  requireAuth as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthenticatedRequest).user;
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { githubAccessToken: true, githubUsername: true },
      });
      res.json({
        data: {
          token: user?.githubAccessToken ?? null,
          githubUsername: user?.githubUsername ?? null,
        },
      });
    } catch {
      res.status(500).json({ error: "Failed to fetch GitHub token" });
    }
  }
);

export default router;
