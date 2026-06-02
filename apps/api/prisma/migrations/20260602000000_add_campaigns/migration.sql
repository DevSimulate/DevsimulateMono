CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');
CREATE TYPE "CandidateStatus" AS ENUM ('NEW', 'REVIEWED', 'SHORTLISTED', 'REJECTED');

CREATE TABLE "Campaign" (
  "id"             TEXT NOT NULL,
  "orgId"          TEXT NOT NULL,
  "roleName"       TEXT NOT NULL,
  "codebaseId"     TEXT NOT NULL,
  "difficulty"     "Difficulty" NOT NULL,
  "candidateLimit" INTEGER NOT NULL DEFAULT 100,
  "deadline"       TIMESTAMP(3),
  "companyName"    TEXT NOT NULL,
  "bookingLink"    TEXT,
  "shareableSlug"  TEXT NOT NULL,
  "status"         "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Campaign_shareableSlug_key" ON "Campaign"("shareableSlug");

ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_codebaseId_fkey"
  FOREIGN KEY ("codebaseId") REFERENCES "Codebase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CampaignCandidate" (
  "id"           TEXT NOT NULL,
  "campaignId"   TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "submissionId" TEXT,
  "status"       "CandidateStatus" NOT NULL DEFAULT 'NEW',
  "invitedAt"    TIMESTAMP(3),
  "joinedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignCandidate_campaignId_userId_key" ON "CampaignCandidate"("campaignId", "userId");

ALTER TABLE "CampaignCandidate" ADD CONSTRAINT "CampaignCandidate_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CampaignCandidate" ADD CONSTRAINT "CampaignCandidate_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CampaignCandidate" ADD CONSTRAINT "CampaignCandidate_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
