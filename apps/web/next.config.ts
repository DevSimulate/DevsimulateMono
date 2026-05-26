import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@devsimulate/shared"],
  // Allow Railway/production API domain for image/fetch sources
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
