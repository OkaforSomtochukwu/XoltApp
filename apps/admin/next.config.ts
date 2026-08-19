import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  transpilePackages: ["@xolt/shared", "@xolt/ui-tokens"],
  agentRules: false,
};

export default nextConfig;
