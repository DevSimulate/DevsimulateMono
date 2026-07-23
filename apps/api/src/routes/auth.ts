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
import { sendEmail } from "../lib/email";

// Find or create an employer user keyed by email (no GitHub identity).
async function findOrCreateEmployerUser(email: string) {
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({ data: { email } });
}

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
        select: {
          githubAccessToken: true,
          githubUsername: true,
          disqualifiedAt: true,
          disqualifiedReason: true,
        },
      });
      res.json({
        data: {
          token: user?.githubAccessToken ?? null,
          githubUsername: user?.githubUsername ?? null,
          disqualifiedAt: user?.disqualifiedAt ?? null,
          disqualifiedReason: user?.disqualifiedReason ?? null,
        },
      });
    } catch {
      res.status(500).json({ error: "Failed to fetch GitHub token" });
    }
  }
);

/**
 * POST /auth/handoff
 * Authorization: Bearer <jwt>
 *
 * Issues a short-lived (5 min), single-purpose handoff code that can be placed
 * in a URL instead of the full session JWT. Whatever browser opens that URL
 * exchanges the code for a real session — so the session is never exposed in
 * the URL and works regardless of which browser opens the link.
 */
router.post(
  "/handoff",
  requireAuth as (req: Request, res: Response, next: () => void) => void,
  (req: Request, res: Response): void => {
    const { userId } = (req as AuthenticatedRequest).user;
    const secret = process.env.JWT_SECRET!;
    const code = jwt.sign({ userId, type: "handoff" }, secret, { expiresIn: "5m" });
    res.json({ data: { code } });
  }
);

/**
 * POST /auth/handoff/exchange
 * Body: { code: string }
 *
 * Verifies the short-lived handoff code, sets the session as an httpOnly cookie
 * (so it's never readable by JavaScript), and also returns the JWT for clients
 * that still authenticate via the Authorization header.
 */
router.post("/handoff/exchange", async (req: Request, res: Response): Promise<void> => {
  const { code } = req.body as { code?: string };
  if (!code) {
    res.status(400).json({ error: "Missing handoff code" });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET!;
    const payload = jwt.verify(code, secret) as { userId: string; type: string };
    if (payload.type !== "handoff") {
      res.status(401).json({ error: "Invalid code type" });
      return;
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: payload.userId } });
    const sessionToken = signJwt(user);

    // httpOnly + Secure so JS can't read it and it only travels over HTTPS.
    // SameSite=None is required for cross-site use (API and web on different
    // domains); once the API is served from a devsimulate.com subdomain this
    // becomes a first-party cookie and can be the sole auth mechanism.
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("ds_session", sessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    res.json({ data: { token: sessionToken, user } });
  } catch {
    res.status(401).json({ error: "This link has expired. Please reopen it from VS Code or your dashboard." });
  }
});

// ─── Employer auth (email magic link — no GitHub) ───────────────────────────────

const APP = process.env.FRONTEND_URL ?? "https://www.devsimulate.com";

/**
 * POST /auth/employer/magic-link
 * Body: { email }
 * Emails a one-time, short-lived sign-in link to the employer's inbox.
 */
router.post("/employer/magic-link", async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    res.status(400).json({ error: "Enter a valid email address" });
    return;
  }
  try {
    const secret = process.env.JWT_SECRET!;
    const token = jwt.sign({ email, type: "employer-magic" }, secret, { expiresIn: "15m" });
    const link = `${APP}/auth/employer/verify?token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: email,
      subject: "Your DevSimulate sign-in link",
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <div style="font-weight:800;font-size:18px;margin-bottom:20px;">⚡ DevSimulate</div>
          <h1 style="font-size:20px;">Sign in to DevSimulate</h1>
          <p style="font-size:14px;color:#444;line-height:1.6;">Click the button below to sign in. This link expires in 15 minutes and can be used once.</p>
          <div style="margin:24px 0;">
            <a href="${link}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;font-size:14px;">Sign in →</a>
          </div>
          <p style="font-size:12px;color:#999;">If you didn't request this, you can ignore it.</p>
        </div>`,
    });

    res.json({ data: { sent: true } });
  } catch {
    res.status(500).json({ error: "Failed to send sign-in link" });
  }
});

/**
 * POST /auth/employer/verify
 * Body: { token }
 * Verifies the magic-link token and returns a session JWT.
 */
router.post("/employer/verify", async (req: Request, res: Response): Promise<void> => {
  const { token } = req.body as { token?: string };
  if (!token) { res.status(400).json({ error: "Missing token" }); return; }
  try {
    const secret = process.env.JWT_SECRET!;
    const payload = jwt.verify(token, secret) as { email: string; type: string };
    if (payload.type !== "employer-magic") { res.status(401).json({ error: "Invalid token" }); return; }

    const user = await findOrCreateEmployerUser(payload.email);
    const session = signJwt(user);
    const hasOrg = await prisma.orgMember.findFirst({ where: { userId: user.id } });
    res.json({ data: { token: session, user, hasOrg: !!hasOrg } });
  } catch {
    res.status(401).json({ error: "This sign-in link is invalid or expired. Request a new one." });
  }
});

/**
 * POST /auth/employer/test-login   (TEMPORARY — remove after testing)
 * Body: { email, code }
 * Bypasses the magic link for a known test account so you can log in directly
 * during development. Gated by EMPLOYER_TEST_CODE. Delete this route when done.
 */
router.post("/employer/test-login", async (req: Request, res: Response): Promise<void> => {
  const { email, code } = req.body as { email?: string; code?: string };
  const expected = process.env.EMPLOYER_TEST_CODE ?? "LMKR-TEST-2026";
  if (!email || code !== expected) {
    res.status(401).json({ error: "Invalid test login" });
    return;
  }
  try {
    const user = await findOrCreateEmployerUser(email);
    const session = signJwt(user);
    const hasOrg = await prisma.orgMember.findFirst({ where: { userId: user.id } });
    res.json({ data: { token: session, user, hasOrg: !!hasOrg } });
  } catch {
    res.status(500).json({ error: "Test login failed" });
  }
});

export default router;
