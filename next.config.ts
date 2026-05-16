import type { NextConfig } from "next";
import packageJson from "./package.json" with { type: "json" };

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "supa.subnet.lv",
        pathname: "/storage/v1/**",
      },
    ],
  },
};

export default nextConfig;
