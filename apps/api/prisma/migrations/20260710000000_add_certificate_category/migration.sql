-- Records which DevFest category a certificate's rank was computed within
-- (Frontend / Backend / DevOps · Infra / System Design).
ALTER TABLE "Certificate" ADD COLUMN "category" TEXT;
