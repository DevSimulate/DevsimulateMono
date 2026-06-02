CREATE TABLE "CandidateDecision" (
  "id"          TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "changedBy"   TEXT NOT NULL,
  "fromStatus"  TEXT NOT NULL,
  "toStatus"    TEXT NOT NULL,
  "wasFlagged"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CandidateDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CandidateDecision_candidateId_idx" ON "CandidateDecision"("candidateId");

ALTER TABLE "CandidateDecision" ADD CONSTRAINT "CandidateDecision_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "CampaignCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
