import { Router, Request, Response } from "express";
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

export default router;
