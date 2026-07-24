-- AlterTable
-- IF NOT EXISTS: applied by hand originally; replaying must be a no-op.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fullName" TEXT;
