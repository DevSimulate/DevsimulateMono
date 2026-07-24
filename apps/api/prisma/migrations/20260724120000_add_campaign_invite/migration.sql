-- Emailed assessment invitations (exist before the candidate has an account).
DO $$ BEGIN
  CREATE TYPE "InviteStatus" AS ENUM ('INVITED', 'STARTED', 'COMPLETED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CampaignInvite" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'INVITED',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remindedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "userId" TEXT,

    CONSTRAINT "CampaignInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignInvite_token_key" ON "CampaignInvite"("token");
CREATE INDEX IF NOT EXISTS "CampaignInvite_token_idx" ON "CampaignInvite"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "CampaignInvite_campaignId_email_key" ON "CampaignInvite"("campaignId", "email");

DO $$ BEGIN
  ALTER TABLE "CampaignInvite" ADD CONSTRAINT "CampaignInvite_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignInvite" ADD CONSTRAINT "CampaignInvite_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
