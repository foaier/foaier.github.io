import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/posts";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts();
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/articles/`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/learn/`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/containers/`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/nginx/`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/resume/`, changeFrequency: "yearly", priority: 0.6 },
  ];

  return [
    ...staticPages,
    ...posts.map((post) => ({
      url: `${siteUrl}/articles/${post.slug}/`,
      lastModified: post.date ? new Date(post.date) : undefined,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
