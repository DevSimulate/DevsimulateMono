import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { AuthenticatedRequest } from "../types/index";
import {
  getAssignedTicket,
  getAssignedTickets,
  assignTicket,
  listTickets,
  getTicketById,
} from "../services/ticket.service";
import prisma from "../lib/prisma";

const router = Router();

// All ticket routes require authentication
router.use(requireAuth as (req: Request, res: Response, next: () => void) => void);

/**
 * GET /tickets/assigned
 * Returns ALL of the current user's active (unreviewed) ticket assignments.
 */
router.get("/assigned", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;

  try {
    const assignments = await getAssignedTickets(userId);
    res.json({ data: assignments });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch assignments";
    console.error("[tickets] getAssigned error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /tickets/:id/assign
 * Assigns the specified ticket to the authenticated user.
 */
router.post(
  "/:id/assign",
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthenticatedRequest).user;
    const { id: ticketId } = req.params;

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });


      const assignment = await assignTicket(userId, ticketId);
      res.status(201).json({ data: assignment });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to assign ticket";
      console.error("[tickets] assign error:", message);
      res.status(500).json({ error: message });
    }
  }
);

/**
 * GET /tickets/assignments/:id
 * Returns a single assignment (with ticket + codebase) owned by the current user.
 */
router.get("/assignments/:id", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  try {
    const assignment = await prisma.ticketAssignment.findFirst({
      where: { id: req.params.id, userId },
      include: { ticket: { include: { codebase: true } } },
    });
    if (!assignment) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }
    res.json({ data: assignment });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch assignment";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /tickets
 * Lists all available tickets. Optional query param: ?stack=DOTNET
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const stack = req.query["stack"] as string | undefined;
  const codebaseId = req.query["codebaseId"] as string | undefined;

  try {
    const tickets = await listTickets(stack, codebaseId);
    res.json({ data: tickets });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list tickets";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /tickets/:id
 * Returns a single ticket by id.
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const ticket = await getTicketById(req.params.id);

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    res.json({ data: ticket });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch ticket";
    res.status(500).json({ error: message });
  }
});

export default router;
