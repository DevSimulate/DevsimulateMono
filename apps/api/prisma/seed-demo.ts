/**
 * CLI entry-point: ts-node prisma/seed-demo.ts
 * Delegates to src/lib/seed-demo.ts so the logic lives in one place.
 */
import { seedDemo } from "../src/lib/seed-demo";

seedDemo()
  .catch((err) => {
    console.error("[seed-demo] Failed:", err);
    process.exit(1);
  });
