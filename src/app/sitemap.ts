import type { MetadataRoute } from "next";

const PUBLIC_PATHS = ["/", "/discover", "/pricing", "/services", "/custom-projects", "/approach", "/about"];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.ATELIER_PUBLIC_ORIGIN?.trim().replace(/\/$/, "") || "http://127.0.0.1:3000";
  return PUBLIC_PATHS.map((path) => ({
    url: `${origin}${path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7
  }));
}
