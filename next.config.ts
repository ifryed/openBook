import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@mlc-ai/web-llm"],
  serverExternalPackages: ["puppeteer"],
};

export default withNextIntl(nextConfig);
