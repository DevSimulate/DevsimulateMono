import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /waitlist
 * Body: { email, codebase }
 * Saves an email + codebase preference for a "Notify Me" waitlist entry.
 * No auth required — anonymous visitors can sign up.
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { email, codebase } = req.body as { email?: string; codebase?: string };

  if (!email || !codebase) {
    res.status(400).json({ error: "email and codebase are required" });
    return;
  }

  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  try {
    await prisma.waitlistEntry.upsert({
      where: { email_codebase: { email: email.toLowerCase().trim(), codebase } },
      create: { email: email.toLowerCase().trim(), codebase },
      update: {},
    });
    res.json({ data: { message: "You're on the list!" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to join waitlist";
    console.error("[waitlist] error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
