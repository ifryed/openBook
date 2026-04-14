import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mlc-ai/web-llm"],
  serverExternalPackages: ["puppeteer"],
};

export default nextConfig;
