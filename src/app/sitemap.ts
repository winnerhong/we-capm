import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://toriro.com";
  const lastModified = new Date();

  return [
    { url: base, lastModified, priority: 1.0 },
    { url: `${base}/events`, lastModified, priority: 0.9 },
    { url: `${base}/programs`, lastModified, priority: 0.8 },
    { url: `${base}/enterprise`, lastModified, priority: 0.8 },
    { url: `${base}/partner`, lastModified, priority: 0.7 },
    { url: `${base}/blog`, lastModified, priority: 0.7 },
    { url: `${base}/faq`, lastModified, priority: 0.6 },
    { url: `${base}/about`, lastModified, priority: 0.5 },
    { url: `${base}/terms`, lastModified, priority: 0.3 },
    { url: `${base}/privacy`, lastModified, priority: 0.3 },
    { url: `${base}/join`, lastModified, priority: 0.8 },
  ];
}
