import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.ATELIER_PUBLIC_ORIGIN?.trim();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/workspace", "/founder", "/project", "/account", "/companion", "/discover"]
    },
    sitemap: origin ? `${origin.replace(/\/$/, "")}/sitemap.xml` : undefined
  };
}
