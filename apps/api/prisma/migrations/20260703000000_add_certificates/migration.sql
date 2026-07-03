CREATE TABLE "Certificate" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "score"      INTEGER NOT NULL,
  "rank"       INTEGER,
  "issuedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Certificate_userId_campaignId_key" ON "Certificate"("userId", "campaignId");
