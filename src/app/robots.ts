import type { MetadataRoute } from "next";
import { getPublicOrigin } from "@/lib/public-origin";

export default function robots(): MetadataRoute.Robots {
  const origin = getPublicOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
