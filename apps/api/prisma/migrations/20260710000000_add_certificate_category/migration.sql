-- Records which DevFest category a certificate's rank was computed within
-- (Frontend / Backend / DevOps · Infra / System Design).
-- IF NOT EXISTS: applied by hand originally; replaying must be a no-op.
ALTER TABLE "Certificate" ADD COLUMN IF NOT EXISTS "category" TEXT;
