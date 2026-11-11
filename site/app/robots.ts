import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // /ingest — служебный адрес аналитики, /api — её же помощник: индексировать там нечего
  return { rules: { userAgent: "*", allow: "/", disallow: ["/ingest/", "/api/"] }, sitemap: `${SITE}/sitemap.xml` };
}
