import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { AuthenticatedRequest } from "../types/index";
import prisma from "../lib/prisma";
import { OrgPlan, OrgRole } from "@prisma/client";

const router = Router();

router.use(requireAuth as (req: Request, res: Response, next: () => void) => void);

async function requireOrgAccess(
  userId: string,
  orgId: string,
  roles: OrgRole[] = [OrgRole.ADMIN, OrgRole.MANAGER]
): Promise<boolean> {
  const member = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  return member !== null && roles.includes(member.role);
}

/**
 * POST /organisations
 * Creates a new organisation and adds the creator as ADMIN.
 */
router.post("/organisations", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { name, domain, plan } = req.body as {
    name?: string;
    domain?: string;
    plan?: OrgPlan;
  };

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  try {
    const org = await prisma.$transaction(async (tx: any) => {
      const created = await tx.organisation.create({
        data: { name, domain, plan: plan ?? OrgPlan.HIRING },
      });
      await tx.orgMember.create({
        data: { orgId: created.id, userId, role: OrgRole.ADMIN },
      });
      return created;
    });

    res.status(201).json({ data: org });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create organisation";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /organisations/:orgId
 * Returns org details + member count + active job count.
 */
router.get("/organisations/:orgId", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { orgId } = req.params;

  try {
    const isMember = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });

    if (!isMember) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const [org, memberCount, activeJobCount] = await Promise.all([
      prisma.organisation.findUnique({ where: { id: orgId } }),
      prisma.orgMember.count({ where: { orgId } }),
      prisma.jobPost.count({ where: { orgId, active: true } }),
    ]);

    if (!org) {
      res.status(404).json({ error: "Organisation not found" });
      return;
    }

    res.json({ data: { ...org, memberCount, activeJobCount } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch organisation";
    res.status(500).json({ error: message });
  }
});

/**
 * POST /organisations/:orgId/members/invite
 * Invites a user by GitHub username and creates a pending OrgMember.
 */
router.post(
  "/organisations/:orgId/members/invite",
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthenticatedRequest).user;
    const { orgId } = req.params;
    const { githubUsername, role } = req.body as {
      githubUsername?: string;
      role?: OrgRole;
    };

    if (!githubUsername) {
      res.status(400).json({ error: "githubUsername is required" });
      return;
    }

    try {
      const hasAccess = await requireOrgAccess(userId, orgId);
      if (!hasAccess) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const invitee = await prisma.user.findUnique({
        where: { githubUsername },
      });

      if (!invitee) {
        res.status(404).json({ error: `No DevSimulate user found for @${githubUsername}` });
        return;
      }

      await prisma.orgMember.upsert({
        where: { orgId_userId: { orgId, userId: invitee.id } },
        create: { orgId, userId: invitee.id, role: role ?? OrgRole.MEMBER },
        update: { role: role ?? OrgRole.MEMBER },
      });

      console.log(`[employer] Invitation sent to @${githubUsername} for org ${orgId}`);

      res.json({ message: "Invitation sent" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to invite member";
      res.status(500).json({ error: message });
    }
  }
);

/**
 * GET /organisations/:orgId/jobs
 * Returns all job posts for this org with application counts.
 */
router.get("/organisations/:orgId/jobs", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { orgId } = req.params;

  try {
    const hasAccess = await requireOrgAccess(userId, orgId, [OrgRole.ADMIN, OrgRole.MANAGER, OrgRole.MEMBER]);
    if (!hasAccess) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const jobs = await prisma.jobPost.findMany({
      where: { orgId },
      include: {
        ticket: { select: { title: true, difficulty: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: jobs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list jobs";
    res.status(500).json({ error: message });
  }
});

/**
 * POST /organisations/:orgId/jobs
 * Creates a new job post.
 */
router.post("/organisations/:orgId/jobs", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { orgId } = req.params;
  const { title, ticketId, description } = req.body as {
    title?: string;
    ticketId?: string;
    description?: string;
  };

  if (!title || !ticketId) {
    res.status(400).json({ error: "title and ticketId are required" });
    return;
  }

  try {
    const hasAccess = await requireOrgAccess(userId, orgId);
    if (!hasAccess) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const job = await prisma.jobPost.create({
      data: { orgId, ticketId, title, description },
      include: { ticket: true },
    });

    res.status(201).json({ data: job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create job post";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /organisations/:orgId/jobs/:jobId/applications
 * Returns all applications for a job, ordered by scoreTotal desc.
 */
router.get(
  "/organisations/:orgId/jobs/:jobId/applications",
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthenticatedRequest).user;
    const { orgId, jobId } = req.params;

    try {
      const hasAccess = await requireOrgAccess(userId, orgId);
      if (!hasAccess) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const applications = await prisma.application.findMany({
        where: { jobPostId: jobId },
        include: {
          user: {
            select: {
              githubUsername: true,
              skillScore: true,
              primaryStack: true,
            },
          },
          submission: {
            select: {
              scoreTotal: true,
              scoreDiagnosis: true,
              scoreDesign: true,
              scoreCommunication: true,
              scoreExecution: true,
              prDescription: true,
              submittedAt: true,
              reviewedAt: true,
            },
          },
        },
        orderBy: { submission: { scoreTotal: "desc" } },
      });

      const data = applications.map((app: any) => ({
        id: app.id,
        status: app.status,
        invitedAt: app.invitedAt,
        completedAt: app.completedAt,
        candidate: app.user,
        submission: app.submission
          ? {
              ...app.submission,
              minutesToComplete:
                app.submission.submittedAt && app.submission.reviewedAt
                  ? Math.round(
                      (new Date(app.submission.reviewedAt).getTime() -
                        new Date(app.submission.submittedAt).getTime()) /
                        60000
                    )
                  : null,
            }
          : null,
      }));

      res.json({ data });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch applications";
      res.status(500).json({ error: message });
    }
  }
);

/**
 * POST /organisations/:orgId/jobs/:jobId/invite
 * Invites a candidate to complete the assessment.
 */
router.post(
  "/organisations/:orgId/jobs/:jobId/invite",
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthenticatedRequest).user;
    const { orgId, jobId } = req.params;
    const { candidateUsername } = req.body as { candidateUsername?: string };

    if (!candidateUsername) {
      res.status(400).json({ error: "candidateUsername is required" });
      return;
    }

    try {
      const hasAccess = await requireOrgAccess(userId, orgId);
      if (!hasAccess) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const [candidate, job] = await Promise.all([
        prisma.user.findUnique({ where: { githubUsername: candidateUsername } }),
        prisma.jobPost.findUnique({
          where: { id: jobId },
          include: { ticket: true, org: true },
        }),
      ]);

      if (!candidate) {
        res.status(404).json({ error: `No DevSimulate user found for @${candidateUsername}` });
        return;
      }

      if (!job) {
        res.status(404).json({ error: "Job post not found" });
        return;
      }

      await prisma.application.upsert({
        where: { jobPostId_userId: { jobPostId: jobId, userId: candidate.id } },
        create: { jobPostId: jobId, userId: candidate.id, status: "INVITED" },
        update: { status: "INVITED" },
      });

      console.log(
        `[employer] Candidate invitation email to @${candidateUsername}:\n` +
          `Subject: You have been invited to complete a DevSimulate assessment\n` +
          `Hi ${candidateUsername}, ${job.org.name} has invited you to complete ` +
          `"${job.ticket.title}" on DevSimulate as part of their hiring process. ` +
          `Login at devsimulate.io to get started.`
      );

      res.json({ message: "Candidate invited" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to invite candidate";
      res.status(500).json({ error: message });
    }
  }
);

/**
 * GET /organisations/:orgId/team/progress
 * Returns all OrgMembers with skill scores, tickets completed, weakest dimension, and trend.
 */
router.get(
  "/organisations/:orgId/team/progress",
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthenticatedRequest).user;
    const { orgId } = req.params;

    try {
      const hasAccess = await requireOrgAccess(userId, orgId);
      if (!hasAccess) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const members = await prisma.orgMember.findMany({
        where: { orgId },
        include: {
          user: {
            include: {
              submissions: {
                where: { status: "REVIEWED" },
                orderBy: { submittedAt: "desc" },
                take: 10,
                select: {
                  scoreTotal: true,
                  scoreDiagnosis: true,
                  scoreDesign: true,
                  scoreCommunication: true,
                  scoreExecution: true,
                  submittedAt: true,
                },
              },
            },
          },
        },
      });

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const data = members.map((m: any) => {
        const subs: any[] = m.user.submissions;
        const thisMonth = subs.filter((s: any) => new Date(s.submittedAt) >= startOfMonth).length;

        const dimensions = [
          { name: "Diagnosis", pct: subs.length > 0 ? subs.reduce((a: number, s: any) => a + (s.scoreDiagnosis ?? 0), 0) / subs.length / 40 : 0 },
          { name: "Design", pct: subs.length > 0 ? subs.reduce((a: number, s: any) => a + (s.scoreDesign ?? 0), 0) / subs.length / 30 : 0 },
          { name: "Communication", pct: subs.length > 0 ? subs.reduce((a: number, s: any) => a + (s.scoreCommunication ?? 0), 0) / subs.length / 20 : 0 },
          { name: "Execution", pct: subs.length > 0 ? subs.reduce((a: number, s: any) => a + (s.scoreExecution ?? 0), 0) / subs.length / 10 : 0 },
        ];
        const weakest = dimensions.reduce((a, b) => a.pct < b.pct ? a : b);

        let trend: "up" | "down" | "stable" = "stable";
        if (subs.length >= 3) {
          const recent = subs.slice(0, 3).map((s: any) => s.scoreTotal ?? 0);
          if (recent[0] > recent[2]) trend = "up";
          else if (recent[0] < recent[2]) trend = "down";
        }

        return {
          userId: m.userId,
          githubUsername: m.user.githubUsername,
          primaryStack: m.user.primaryStack,
          skillScore: m.user.skillScore,
          role: m.role,
          ticketsThisMonth: thisMonth,
          ticketsTotal: subs.length,
          weakestDimension: weakest.name,
          trend,
        };
      });

      res.json({ data });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch team progress";
      res.status(500).json({ error: message });
    }
  }
);

export default router;
