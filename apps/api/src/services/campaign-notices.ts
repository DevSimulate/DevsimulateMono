/**
 * Who gets told what when a round changes shape.
 *
 * Lives outside the route so the employer button and the operator CLI select
 * the same people. When the pilot needed an email sent at short notice the
 * targeting was rewritten inline against production, which is how a "started
 * but unfinished" list quietly becomes "everyone".
 */
import prisma from "../lib/prisma";
import { sendEmail, deadlineExtendedEmail } from "../lib/email";

export interface NoticeRecipient {
  id: string;
  email: string;
  name: string | null;
  token: string;
  userId: string | null;
}

export interface NoticeCampaign {
  id: string;
  roleName: string;
  companyName: string;
  shareableSlug: string;
  ticketIds: string[];
  deadline: Date | null;
  org: { brandName: string | null; logoUrl: string | null; primaryColor: string | null };
}

/**
 * Everyone on this campaign who has started and not finished.
 *
 * "Finished" is a finalized submission on one of the campaign's own tickets —
 * not merely having a submission row, which a candidate who abandoned halfway
 * also has.
 */
export async function startedUnfinished(campaign: NoticeCampaign): Promise<NoticeRecipient[]> {
  const invites = await prisma.campaignInvite.findMany({
    where: { campaignId: campaign.id, userId: { not: null } },
    select: { id: true, email: true, name: true, token: true, userId: true },
  });

  const candidateIds = invites.map((i) => i.userId).filter((v): v is string => !!v);
  const finalized = candidateIds.length
    ? await prisma.submission.findMany({
        where: {
          userId: { in: candidateIds },
          finalized: true,
          ...(campaign.ticketIds.length ? { ticketId: { in: campaign.ticketIds } } : {}),
        },
        select: { userId: true },
      })
    : [];
  const done = new Set(finalized.map((s) => s.userId));

  return invites.filter((i) => i.userId && !done.has(i.userId));
}

/**
 * Sends the "we've extended the deadline" notice to everyone mid-assessment.
 *
 * `remindedAt` is stamped only on a successful send, so a provider outage
 * doesn't consume a candidate's reminder schedule for a mail that never landed.
 */
export async function sendDeadlineExtended(
  campaign: NoticeCampaign,
  targets: NoticeRecipient[],
  appUrl: string,
  /**
   * Off for operator previews, whose recipient is synthetic and has no invite
   * row to stamp — and whose whole point is to change nothing.
   */
  opts: { stamp?: boolean } = {}
): Promise<number> {
  if (!campaign.deadline) throw new Error("Campaign has no deadline");
  const stamp = opts.stamp !== false;
  const brandName = campaign.org.brandName || campaign.companyName;
  let sent = 0;

  for (const t of targets) {
    const { subject, html } = deadlineExtendedEmail({
      candidateName: t.name,
      brandName,
      logoUrl: campaign.org.logoUrl,
      primaryColor: campaign.org.primaryColor,
      roleName: campaign.roleName,
      link: `${appUrl}/apply/${campaign.shareableSlug}?invite=${t.token}`,
      deadline: campaign.deadline,
    });
    if (await sendEmail({ to: t.email, subject, html, meta: { type: "INVITE", campaignId: campaign.id } })) {
      if (stamp) await prisma.campaignInvite.update({ where: { id: t.id }, data: { remindedAt: new Date() } });
      sent++;
    }
  }
  return sent;
}
