import { Router, Request, Response } from "express";
import nodemailer from "nodemailer";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

const transporter = nodemailer.createTransport({
  host: "mail.privateemail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { message, rating, ticketTitle, score } = req.body as {
    message: string;
    rating: number;
    ticketTitle: string;
    score: number;
  };

  const user = (req as any).user as { githubUsername: string };

  if (!message?.trim()) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  try {
    await transporter.sendMail({
      from: `"DevSimulate Feedback" <${process.env.EMAIL_USER}>`,
      to: "ossama@devsimulate.com",
      subject: `[Feedback] ${user.githubUsername} · Score ${score ?? "?"}/100 · ${ticketTitle ?? "Unknown ticket"}`,
      text: [
        `From: ${user.githubUsername}`,
        `Ticket: ${ticketTitle ?? "—"}`,
        `Score: ${score ?? "—"}/100`,
        `Rating: ${"★".repeat(rating ?? 0)}${"☆".repeat(5 - (rating ?? 0))} (${rating ?? "—"}/5)`,
        ``,
        `Message:`,
        message,
      ].join("\n"),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("[feedback] email send failed:", err);
    res.status(500).json({ error: "Failed to send feedback" });
  }
});

export default router;
