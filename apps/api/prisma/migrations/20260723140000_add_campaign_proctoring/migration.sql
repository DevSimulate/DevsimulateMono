-- Per-campaign proctoring toggles (paste blocking + fullscreen lock). Default strict.
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "blockPaste" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "requireFullscreen" BOOLEAN NOT NULL DEFAULT true;
