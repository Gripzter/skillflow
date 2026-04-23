import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: "https://skillflow.gg",
      lastModified,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: "https://skillflow.gg/login",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: "https://skillflow.gg/signup",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: "https://skillflow.gg/leaderboard",
      lastModified,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: "https://skillflow.gg/play",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://skillflow.gg/founders",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];
}
