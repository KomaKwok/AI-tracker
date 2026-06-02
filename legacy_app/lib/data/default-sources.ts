import { Source } from "@/lib/types";

export const defaultSources: Source[] = [
  {
    id: "claude-release-notes",
    name: "Claude Release Notes",
    url: "https://platform.claude.com/docs/en/release-notes/overview",
    fallbackUrls: ["https://docs.anthropic.com/en/release-notes/overview"],
    sitemapUrl: "https://docs.anthropic.com/sitemap.xml",
    region: "Global",
    sourceType: "Official",
    priority: 10,
    fetchStrategy: "release-notes-html",
    active: true,
    lastFetchedAt: null
  },
  {
    id: "openai-news-rss",
    name: "OpenAI News RSS",
    url: "https://openai.com/news/rss.xml",
    feedUrls: ["https://openai.com/news/rss.xml"],
    region: "Global",
    sourceType: "Official",
    priority: 10,
    fetchStrategy: "rss-feed",
    active: true,
    lastFetchedAt: null
  },
  {
    id: "openai-api-changelog",
    name: "OpenAI API Changelog",
    url: "https://developers.openai.com/api/docs/changelog",
    fallbackUrls: ["https://platform.openai.com/docs/changelog"],
    sitemapUrl: "https://developers.openai.com/sitemap.xml",
    region: "Global",
    sourceType: "Official",
    priority: 10,
    fetchStrategy: "docs-changelog-html",
    active: true,
    lastFetchedAt: null
  },
  {
    id: "gemini-api-changelog",
    name: "Gemini API Changelog",
    url: "https://ai.google.dev/gemini-api/docs/changelog",
    fallbackUrls: ["https://ai.google.dev/gemini-api/docs/changelog?hl=en"],
    sitemapUrl: "https://ai.google.dev/sitemap.xml",
    region: "Global",
    sourceType: "Official",
    priority: 9,
    fetchStrategy: "docs-changelog-html",
    active: true,
    lastFetchedAt: null
  }
];
