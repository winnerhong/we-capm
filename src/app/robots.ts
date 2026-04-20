import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://toriro.com";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/manager",
        "/api",
        "/partner/dashboard",
        "/partner/programs",
        "/partner/analytics",
        "/partner/settings",
        "/ads-portal",
        "/store/dashboard",
        "/event/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
