import prisma from "../lib/prisma";
import { Ticket, TicketAssignment, Codebase } from "@prisma/client";
import slugify from "../lib/slugify";

type TicketWithCodebase = Ticket & { codebase: Codebase };
type AssignmentWithTicket = TicketAssignment & { ticket: TicketWithCodebase };

/**
 * Returns the active ticket assignment for the given user, including the
 * ticket and its parent codebase. Returns null if no assignment exists.
 */
export async function getAssignedTicket(
  userId: string
): Promise<AssignmentWithTicket | null> {
  // Find the most recently assigned ticket that has no reviewed submission yet
  const assignments = await prisma.ticketAssignment.findMany({
    where: { userId },
    include: { ticket: { include: { codebase: true } } },
    orderBy: { assignedAt: "desc" },
  });

  for (const assignment of assignments) {
    const reviewed = await prisma.submission.findFirst({
      where: { userId, ticketId: assignment.ticketId, status: "REVIEWED" },
    });
    if (!reviewed) return assignment;
  }

  // All tickets reviewed — no active assignment
  return null;
}

/**
 * Assigns a ticket to a user if they do not already have an active assignment.
 * Returns the existing assignment if one already exists, otherwise creates a
 * new one and generates a canonical branch name.
 */
export async function assignTicket(
  userId: string,
  ticketId: string
): Promise<AssignmentWithTicket> {
  const existing = await prisma.ticketAssignment.findUnique({
    where: { userId_ticketId: { userId, ticketId } },
    include: { ticket: { include: { codebase: true } } },
  });

  if (existing) {
    return existing;
  }

  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { codebase: true },
  });

  const slug = slugify(ticket.title);
  const branchName = `ds/ticket-${ticketId.slice(0, 8)}-${slug}`;

  return prisma.ticketAssignment.create({
    data: { userId, ticketId, branchName },
    include: { ticket: { include: { codebase: true } } },
  });
}

/**
 * Returns all available tickets, optionally filtered by stack.
 */
export async function listTickets(
  stack?: string
): Promise<TicketWithCodebase[]> {
  return prisma.ticket.findMany({
    where: stack ? { stack: stack as Ticket["stack"] } : undefined,
    include: { codebase: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Returns a single ticket by id with its codebase.
 */
export async function getTicketById(
  id: string
): Promise<TicketWithCodebase | null> {
  return prisma.ticket.findUnique({
    where: { id },
    include: { codebase: true },
  });
}
