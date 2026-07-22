-- Participant feedback survey responses (public, optionally anonymous).
CREATE TABLE IF NOT EXISTS "SurveyResponse" (
    "id" TEXT NOT NULL,
    "event" TEXT,
    "overallRating" INTEGER,
    "nps" INTEGER,
    "vsTraditional" TEXT,
    "vsTraditionalWhy" TEXT,
    "ticketClear" INTEGER,
    "ticketRealistic" INTEGER,
    "ticketChallenging" INTEGER,
    "difficulty" TEXT,
    "timeGiven" TEXT,
    "instructionsClear" TEXT,
    "instructionsIssue" TEXT,
    "aiFeel" TEXT,
    "aiComments" TEXT,
    "verbalFeel" TEXT,
    "verbalComments" TEXT,
    "fairChance" TEXT,
    "technicalIssues" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "issueResolution" TEXT,
    "bestPart" TEXT,
    "improve" TEXT,
    "contact" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SurveyResponse_event_idx" ON "SurveyResponse"("event");
