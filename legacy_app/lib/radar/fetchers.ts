import crypto from "node:crypto";
import { defaultSources } from "@/lib/data/default-sources";
import { readStore, writeStore } from "@/lib/data/store";
import { enrichSignalWithAi } from "@/lib/ai/client";
import { writeRadarExports } from "@/lib/radar/export";
import { calculateFirstHandScore, calculateHeatScore, calculateSignalScore } from "@/lib/radar/scoring";
import { generateTrendSummary } from "@/lib/radar/trends";
import { Signal, Source, Tag } from "@/lib/types";

interface RawFetchedItem {
  title: string;
  url: string;
  company: string;
  publishedAt: string;
  snippet: string;
  tags?: Tag[];
}

interface FetchAttemptResult {
  url: string;
  text: string;
}

interface RefreshOptions {
  sourceIds?: string[];
  excludeSourceIds?: string[];
}

const USER_AGENT = "AI-Radar-MVP/1.0";
const REQUEST_TIMEOUT_MS = 12000;
const SOURCE_TIMEOUT_MS = 15000;
const DEBUG_FETCH = process.env.DEBUG_FETCH === "1";
const POSITIVE_PRODUCT_TERMS = [
  "introducing",
  "launch",
  "released",
  "release",
  "model",
  "api",
  "agent",
  "assistant",
  "search",
  "sdk",
  "developer",
  "coding",
  "multimodal",
  "robotics",
  "image",
  "video",
  "vision",
  "open source",
  "open-sourced",
  "cli",
  "copilot",
  "platform",
  "feature",
  "update",
  "gemini",
  "claude",
  "gpt",
  "qwen",
  "kimi"
];
const NEGATIVE_PRODUCT_TERMS = [
  "statement",
  "comments",
  "department of war",
  "secretary",
  "policy",
  "security bulletin",
  "partnership",
  "hiring",
  "careers",
  "grants",
  "scholarship",
  "election",
  "economic",
  "news corp",
  "guardian",
  "conde nast",
  "hearst",
  "media group"
];

function hash(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function unwrapCdata(value: string) {
  return value.replace(/^<!\[CDATA\[/i, "").replace(/\]\]>$/i, "").trim();
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanXmlText(value: string) {
  return stripHtml(decodeXmlEntities(unwrapCdata(value)));
}

function absoluteUrl(baseUrl: string, maybeRelative: string) {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return maybeRelative;
  }
}

function isRelevantProductSignal(item: RawFetchedItem, source: Source) {
  const haystack = `${item.title} ${item.snippet}`.toLowerCase();
  const hasPositive = POSITIVE_PRODUCT_TERMS.some((term) => haystack.includes(term));
  const hasNegative = NEGATIVE_PRODUCT_TERMS.some((term) => haystack.includes(term));

  if (source.sourceType === "Official") {
    if (source.fetchStrategy === "release-notes-html" || source.fetchStrategy === "docs-changelog-html") {
      return !hasNegative && haystack.length > 24;
    }

    return hasPositive && !hasNegative;
  }

  if (source.sourceType === "GitHub") {
    return true;
  }

  if (source.sourceType === "HN") {
    return hasPositive;
  }

  return hasPositive && !hasNegative;
}

function buildReadableSummary(source: Source, title: string, snippet: string, aiSummary: string) {
  const cleanedSnippet = snippet
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (source.sourceType === "GitHub") {
    const featureMatch = cleanedSnippet.match(
      /\b(?:features?|fix(?:es)?|bug fixes?|what's changed)\b[:\s-]*(.{20,220})/i
    );
    if (featureMatch?.[1]) {
      return featureMatch[1].replace(/\s+/g, " ").replace(/[.;,:-]+$/, "").trim() + ".";
    }

    return `${title} reflects a new GitHub release with developer-facing changes to the SDK or platform surface.`;
  }

  if (source.sourceType === "Official") {
    const sentence = cleanedSnippet
      .split(/[.!?]/)
      .map((part) => part.trim())
      .find((part) => part.length > 30 && !/^(github|demo|discord|paper|tech report|qwen chat)$/i.test(part));

    if (sentence) {
      return sentence.replace(/[.;,:-]+$/, "").trim() + ".";
    }
  }

  return aiSummary;
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    next: { revalidate: 0 }
  });

  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`);
  }

  return response.text();
}

async function withSourceTimeout<T>(promise: Promise<T>, source: Source): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${source.name} timed out after ${SOURCE_TIMEOUT_MS / 1000}s`)), SOURCE_TIMEOUT_MS)
    )
  ]);
}

async function fetchFirstAvailableText(urls: string[]): Promise<FetchAttemptResult> {
  const errors: string[] = [];

  for (const url of urls) {
    try {
      const text = await fetchText(url);
      return { url, text };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${url} -> ${message}`);
    }
  }

  throw new Error(errors.join(" | "));
}

function extractMetaContent(html: string, keys: string[]) {
  for (const key of keys) {
    const match = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"));
    if (match?.[1]) {
      return stripHtml(match[1]);
    }
  }
  return "";
}

function parseDateGuess(text: string) {
  const direct = Date.parse(text);
  if (!Number.isNaN(direct)) {
    return new Date(direct).toISOString();
  }

  const datePatterns = [
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s+\d{4}\b/i,
    /\b\d{4}-\d{2}-\d{2}\b/,
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/i
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match?.[0]) {
      const parsed = Date.parse(match[0]);
      if (!Number.isNaN(parsed)) {
        return new Date(parsed).toISOString();
      }
    }
  }

  return new Date().toISOString();
}

function parseRssItems(xml: string) {
  const itemMatches = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)];
  return itemMatches.map((match) => {
    const itemXml = match[0];
    const title = cleanXmlText(itemXml.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const url = cleanXmlText(itemXml.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "");
    const snippet = cleanXmlText(
      itemXml.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ??
        itemXml.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i)?.[1] ??
        ""
    );
    const publishedAt = parseDateGuess(cleanXmlText(itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? ""));

    return { title, url, snippet, publishedAt };
  });
}

function parseAtomItems(xml: string) {
  const entryMatches = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)];
  return entryMatches.map((match) => {
    const entryXml = match[0];
    const title = cleanXmlText(entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const linkMatch = entryXml.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
    const url = cleanXmlText(linkMatch?.[1] ?? "");
    const snippet = cleanXmlText(
      entryXml.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] ??
        entryXml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ??
        ""
    );
    const publishedAt = parseDateGuess(
      cleanXmlText(
        entryXml.match(/<updated>([\s\S]*?)<\/updated>/i)?.[1] ??
          entryXml.match(/<published>([\s\S]*?)<\/published>/i)?.[1] ??
          ""
      )
    );

    return { title, url, snippet, publishedAt };
  });
}

async function fetchFeedItems(
  source: Source,
  company: string,
  defaultTags?: Tag[]
): Promise<RawFetchedItem[]> {
  const feedUrls = source.feedUrls ?? [];
  if (!feedUrls.length) {
    return [];
  }

  const feedSets = await Promise.all(
    feedUrls.map(async (feedUrl) => {
      const xml = await fetchText(feedUrl);
      const parsed = xml.includes("<entry") ? parseAtomItems(xml) : parseRssItems(xml);
      return parsed.map((item) => ({
        title: item.title,
        url: item.url,
        company,
        publishedAt: item.publishedAt,
        snippet: item.snippet,
        tags: defaultTags
      }));
    })
  );

  return feedSets
    .flat()
    .filter((item, index, list) => item.title && item.url && list.findIndex((candidate) => candidate.url === item.url) === index)
    .slice(0, 12);
}

async function fetchArticleMeta(url: string) {
  const html = await fetchText(url);
  const title =
    extractMetaContent(html, ["og:title", "twitter:title"]) ||
    stripHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const snippet =
    extractMetaContent(html, ["description", "og:description", "twitter:description"]) ||
    stripHtml(html.match(/<p>([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const dateText =
    html.match(/datetime=["']([^"']+)["']/i)?.[1] ??
    html.match(/Published[:\s]+([^<\n]+)/i)?.[1] ??
    html.match(/([A-Z][a-z]+ \d{1,2}, \d{4})/i)?.[1] ??
    "";

  return {
    title,
    snippet,
    publishedAt: parseDateGuess(dateText)
  };
}

async function fetchOpenAiItems(): Promise<RawFetchedItem[]> {
  try {
    const xml = await fetchText("https://openai.com/news/rss.xml");
    const items = parseRssItems(xml)
      .filter((item) => item.url && item.title)
      .slice(0, 8)
      .map((item) => ({
        title: item.title,
        url: item.url,
        company: "OpenAI",
        publishedAt: item.publishedAt,
        snippet: item.snippet
      }));

    if (items.length) {
      return items;
    }
  } catch {}

  const html = await fetchText("https://openai.com/news/");
  const candidates = [...html.matchAll(/href=["'](\/(?:index|blog|global-affairs)\/[^"']+)["']/gi)]
    .map((match) => absoluteUrl("https://openai.com/news/", match[1]))
    .filter((url, index, list) => list.indexOf(url) === index)
    .slice(0, 12);

  const items = await Promise.all(
    candidates.map(async (url) => {
      const meta = await fetchArticleMeta(url);
      return {
        title: meta.title,
        url,
        company: "OpenAI",
        publishedAt: meta.publishedAt,
        snippet: meta.snippet
      };
    })
  );

  return items.filter((item) => item.title && item.url);
}

async function fetchOpenAiNewsRssItems(source: Source): Promise<RawFetchedItem[]> {
  const items = await fetchOpenAiItems();
  return items
    .map((item) => ({
      ...item,
      tags: ["API"] as Tag[]
    }))
    .filter((item) => item.title && item.url)
    .slice(0, 8);
}

async function fetchAnthropicItems(): Promise<RawFetchedItem[]> {
  const html = await fetchText("https://www.anthropic.com/news");
  const candidates = [...html.matchAll(/href=["'](\/news\/[^"']+)["']/gi)]
    .map((match) => absoluteUrl("https://www.anthropic.com", match[1]))
    .filter((url, index, list) => list.indexOf(url) === index)
    .slice(0, 4);

  const items = await Promise.all(
    candidates.map(async (url) => {
      const meta = await fetchArticleMeta(url);
      return {
        title: meta.title,
        url,
        company: "Anthropic",
        publishedAt: meta.publishedAt,
        snippet: meta.snippet
      };
    })
  );

  return items.filter((item) => item.title && item.snippet).slice(0, 5);
}

async function fetchDeepMindItems(): Promise<RawFetchedItem[]> {
  const html = await fetchText("https://deepmind.google/discover/blog/");
  const candidates = [...html.matchAll(/<a[^>]+href=["']([^"']*\/discover\/blog\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      url: absoluteUrl("https://deepmind.google/discover/blog/", match[1]),
      title: stripHtml(match[2] ?? "")
    }))
    .filter((item, index, list) => item.title.length > 12 && list.findIndex((candidate) => candidate.url === item.url) === index)
    .slice(0, 4);

  const items = await Promise.all(
    candidates.map(async (candidate) => {
      const meta = await fetchArticleMeta(candidate.url);
      return {
        title: meta.title || candidate.title,
        url: candidate.url,
        company: "Google DeepMind",
        publishedAt: meta.publishedAt,
        snippet: meta.snippet
      };
    })
  );

  return items.filter((item) => item.title && item.url);
}

async function fetchQwenItems(): Promise<RawFetchedItem[]> {
  const html = await fetchText("https://qwenlm.github.io/blog/");
  const articleMatches = [...html.matchAll(/<article class=post-entry>([\s\S]*?)<\/article>/gi)];
  const candidates = articleMatches
    .map((match) => {
      const block = match[1] ?? "";
      const title = stripHtml(block.match(/<h2>([\s\S]*?)<\/h2>/i)?.[1] ?? "");
      const url = absoluteUrl(
        "https://qwenlm.github.io/blog/",
        block.match(/<a class=entry-link[^>]+href=([^>\s]+)[^>]*>/i)?.[1] ?? ""
      );

      return { url, title };
    })
    .filter((item, index, list) => item.title && item.url && list.findIndex((candidate) => candidate.url === item.url) === index)
    .slice(0, 5);

  const items = await Promise.all(
    candidates.map(async (candidate) => {
      const meta = await fetchArticleMeta(candidate.url);
      return {
        title: meta.title || candidate.title,
        url: candidate.url,
        company: "Qwen",
        publishedAt: meta.publishedAt,
        snippet: meta.snippet
      };
    })
  );

  return items.filter((item) => item.title && item.url);
}

async function fetchGitHubItems(): Promise<RawFetchedItem[]> {
  const repos = [
    { repo: "openai/openai-agents-python", company: "OpenAI" },
    { repo: "openai/openai-node", company: "OpenAI" }
  ];

  const all = await Promise.all(
    repos.map(async ({ repo, company }) => {
      const response = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=3`, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": USER_AGENT
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        next: { revalidate: 0 }
      });

      if (!response.ok) {
        throw new Error(`GitHub releases unavailable for ${repo}`);
      }

      const releases = (await response.json()) as Array<{
        name: string | null;
        tag_name: string;
        html_url: string;
        published_at: string;
        body: string | null;
      }>;

      return releases.map((release) => ({
        title: release.name || `${repo} ${release.tag_name}`,
        url: release.html_url,
        company,
        publishedAt: release.published_at,
        snippet: stripHtml(release.body || release.tag_name),
        tags: ["Open Source", "Coding"] as Tag[]
      }));
    })
  );

  return all.flat().slice(0, 6);
}

async function fetchMetaLlamaItems(): Promise<RawFetchedItem[]> {
  const response = await fetch("https://api.github.com/repos/meta-llama/llama-models/releases?per_page=4", {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    next: { revalidate: 0 }
  });

  if (!response.ok) {
    throw new Error("Meta Llama releases unavailable");
  }

  const releases = (await response.json()) as Array<{
    name: string | null;
    tag_name: string;
    html_url: string;
    published_at: string;
    body: string | null;
  }>;

  return releases.map((release) => ({
    title: release.name || release.tag_name,
    url: release.html_url,
    company: "Meta",
    publishedAt: release.published_at,
    snippet: stripHtml(release.body || release.tag_name),
    tags: ["Open Source", "Model Release"] as Tag[]
  }));
}

async function fetchDeepSeekItems(): Promise<RawFetchedItem[]> {
  const reposResponse = await fetch("https://api.github.com/orgs/deepseek-ai/repos?sort=updated&per_page=5", {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    next: { revalidate: 0 }
  });

  if (!reposResponse.ok) {
    throw new Error("DeepSeek org repos unavailable");
  }

  const repos = (await reposResponse.json()) as Array<{ name: string; full_name: string }>;
  const releaseSets = await Promise.all(
    repos.slice(0, 4).map(async (repo) => {
      const response = await fetch(`https://api.github.com/repos/${repo.full_name}/releases?per_page=2`, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": USER_AGENT
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        next: { revalidate: 0 }
      });

      if (!response.ok) {
        return [];
      }

      const releases = (await response.json()) as Array<{
        name: string | null;
        tag_name: string;
        html_url: string;
        published_at: string;
        body: string | null;
      }>;

      return releases.map((release) => ({
        title: release.name || `${repo.name} ${release.tag_name}`,
        url: release.html_url,
        company: "DeepSeek",
        publishedAt: release.published_at,
        snippet: stripHtml(release.body || release.tag_name),
        tags: ["Open Source", "Model Release"] as Tag[]
      }));
    })
  );

  return releaseSets.flat().slice(0, 6);
}

async function fetchClaudeReleaseNotesItems(source: Source): Promise<RawFetchedItem[]> {
  const { url, text: html } = await fetchFirstAvailableText([source.url, ...(source.fallbackUrls ?? [])]);
  const sectionMatches = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[^>]*>|$)/gi)].slice(0, 10);

  const items: RawFetchedItem[] = [];
  for (const match of sectionMatches) {
    const heading = stripHtml(match[1] ?? "");
    if (!/\d{4}/.test(heading)) {
      continue;
    }

    const publishedAt = parseDateGuess(heading);
    const listBlock = match[2] ?? "";
    const bulletMatches = [...listBlock.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];

    for (const bullet of bulletMatches) {
      const snippet = stripHtml(bullet[1] ?? "");
      if (!snippet) {
        continue;
      }

      const title = snippet.split(".")[0]?.trim().slice(0, 120) || "Claude platform update";
      items.push({
        title,
        url,
        company: "Anthropic",
        publishedAt,
        snippet
      });
    }
  }

  return items.slice(0, 8);
}

async function fetchGeminiChangelogItems(): Promise<RawFetchedItem[]> {
  const { url, text: html } = await fetchFirstAvailableText([
    "https://ai.google.dev/gemini-api/docs/changelog",
    "https://ai.google.dev/gemini-api/docs/changelog?hl=en"
  ]);
  const sectionMatches = [...html.matchAll(/<h2[^>]*id=["'][^"']+["'][^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2[^>]*id=|$)/gi)];
  const items: RawFetchedItem[] = [];

  for (const match of sectionMatches) {
    const heading = stripHtml(match[1] ?? "");
    const block = match[2] ?? "";

    if (!/\d{4}/.test(heading)) {
      continue;
    }

    const publishedAt = parseDateGuess(heading);

    const bulletMatches = [...block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
    for (const bullet of bulletMatches) {
      const snippet = stripHtml(bullet[1] ?? "")
        .replace(/\s+/g, " ")
        .trim();

      if (!snippet || snippet.length < 24) {
        continue;
      }

      const title = snippet
        .replace(/^(new|added|introducing|released|launch(ed)?|preview|beta|ga)\s+/i, "")
        .split(/[.;:]/)[0]
        ?.trim()
        .slice(0, 120);

      if (!title) {
        continue;
      }

      items.push({
        title,
        url,
        company: "Google",
        publishedAt,
        snippet
      });
    }
  }

  return items.slice(0, 12);
}

async function fetchMistralChangelogItems(source: Source): Promise<RawFetchedItem[]> {
  const targets = [source.url, ...(source.fallbackUrls ?? [])];
  const { url, text: html } = await fetchFirstAvailableText(targets);
  const sectionMatches = [...html.matchAll(/<h2[^>]*id=["'][^"']+["'][^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2[^>]*id=|$)/gi)];
  const items: RawFetchedItem[] = [];

  for (const match of sectionMatches) {
    const heading = stripHtml(match[1] ?? "");
    if (!/\d{4}/.test(heading)) {
      continue;
    }

    const publishedAt = parseDateGuess(heading);
    const block = match[2] ?? "";
    const bulletMatches = [...block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];

    for (const bullet of bulletMatches) {
      const snippet = stripHtml(bullet[1] ?? "").replace(/\s+/g, " ").trim();
      if (!snippet || snippet.length < 20) {
        continue;
      }

      const title =
        snippet
          .replace(/^(new|added|introducing|released|launch(ed)?|preview|beta|ga)\s+/i, "")
          .split(/[.;:]/)[0]
          ?.trim()
          .slice(0, 120) || "Mistral platform update";

      items.push({
        title,
        url,
        company: "Mistral",
        publishedAt,
        snippet
      });
    }
  }

  return items.slice(0, 12);
}

async function fetchOpenAiApiChangelogItems(source: Source): Promise<RawFetchedItem[]> {
  const targets = [source.url, ...(source.fallbackUrls ?? [])];
  const { url, text: html } = await fetchFirstAvailableText(targets);
  const sectionMatches = [
    ...html.matchAll(
      /<h(?:2|3)[^>]*>([A-Z][a-z]+(?:\s+\d{1,2})?,\s+\d{4}|[A-Z][a-z]+\s+\d{4})<\/h(?:2|3)>([\s\S]*?)(?=<h(?:2|3)[^>]*>|$)/gi
    )
  ];
  const items: RawFetchedItem[] = [];

  for (const match of sectionMatches) {
    const heading = stripHtml(match[1] ?? "");
    if (!/\d{4}/.test(heading)) {
      continue;
    }

    const publishedAt = parseDateGuess(heading);
    const block = match[2] ?? "";
    const bulletMatches = [...block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];

    for (const bullet of bulletMatches) {
      const snippet = stripHtml(bullet[1] ?? "").replace(/\s+/g, " ").trim();
      if (!snippet || snippet.length < 24) {
        continue;
      }

      const title = snippet.split(/[.;:]/)[0]?.trim().slice(0, 120) || "OpenAI API update";
      items.push({
        title,
        url,
        company: "OpenAI",
        publishedAt,
        snippet,
        tags: ["API"] as Tag[]
      });
    }
  }

  return items.slice(0, 12);
}

async function fetchSourceItems(source: Source): Promise<RawFetchedItem[]> {
  if (source.id === "openai-news-rss") {
    return (await fetchOpenAiNewsRssItems(source)).filter((item) => isRelevantProductSignal(item, source));
  }
  if (source.id === "claude-release-notes") {
    return (await fetchClaudeReleaseNotesItems(source)).filter((item) => isRelevantProductSignal(item, source));
  }
  if (source.id === "openai-api-changelog") {
    return (await fetchOpenAiApiChangelogItems(source)).filter((item) => isRelevantProductSignal(item, source));
  }
  if (source.id === "chatgpt-release-notes" || source.id === "openai-model-release-notes") {
    return [];
  }
  if (source.id === "gemini-api-changelog") {
    return (await fetchGeminiChangelogItems()).filter((item) => isRelevantProductSignal(item, source));
  }
  if (source.id === "mistral-changelog") {
    return (await fetchMistralChangelogItems(source)).filter((item) => isRelevantProductSignal(item, source));
  }
  if (source.id === "meta-llama-releases") {
    try {
      const feedItems = await fetchFeedItems(source, "Meta", ["Open Source", "Model Release"]);
      if (feedItems.length) {
        return feedItems;
      }
    } catch {}

    return await fetchMetaLlamaItems();
  }
  if (source.id === "deepseek-github") {
    try {
      const feedItems = await fetchFeedItems(source, "DeepSeek", ["Open Source", "Model Release"]);
      if (feedItems.length) {
        return feedItems;
      }
    } catch {}

    return await fetchDeepSeekItems();
  }
  if (source.id === "xai-news") {
    return [];
  }

  return [];
}

async function normalizeSignal(source: Source, item: RawFetchedItem): Promise<Signal> {
  const ai = await enrichSignalWithAi({
    title: item.title,
    snippet: item.snippet
  });
  const tags = (item.tags?.length ? item.tags : ai.tags).slice(0, 4) as Tag[];
  const firstHandScore = calculateFirstHandScore({
    sourceType: source.sourceType,
    fetchStrategy: source.fetchStrategy,
    priority: source.priority
  });
  const heatScore = calculateHeatScore({
    title: item.title,
    snippet: item.snippet,
    tags
  });
  const signalScore = calculateSignalScore({
    publishedAt: item.publishedAt,
    sourceType: source.sourceType,
    fetchStrategy: source.fetchStrategy,
    title: item.title,
    snippet: item.snippet,
    tags,
    priority: source.priority
  });
  const dedupeHash = hash(`${item.title}:${item.url}`);

  return {
    id: dedupeHash.slice(0, 12),
    title: item.title,
    url: item.url,
    sourceName: source.name,
    sourceType: source.sourceType,
    company: item.company,
    region: source.region,
    publishedAt: item.publishedAt,
    fetchedAt: new Date().toISOString(),
    summary: buildReadableSummary(source, item.title, item.snippet, ai.summary),
    tags,
    firstHandScore,
    heatScore,
    signalScore,
    rawContentSnippet: item.snippet,
    dedupeHash
  };
}

export async function refreshRadarData() {
  return refreshRadarDataWithOptions();
}

async function runRefreshForSources(store: Awaited<ReturnType<typeof readStore>>, sources: Source[]) {
  const existingByHash = new Map(store.signals.map((signal) => [signal.dedupeHash, signal]));
  const nextSignals = [...store.signals];
  const allSources = store.sources.length ? store.sources : defaultSources;

  for (const source of sources) {
    try {
      const rawItems = await withSourceTimeout(fetchSourceItems(source), source);
      for (const item of rawItems) {
        const signal = await normalizeSignal(source, item);
        if (!existingByHash.has(signal.dedupeHash)) {
          existingByHash.set(signal.dedupeHash, signal);
          nextSignals.push(signal);
        }
      }
      source.lastFetchStatus = rawItems.length ? "success" : "empty";
      source.lastFetchMessage = rawItems.length
        ? `Stored ${rawItems.length} verified signals`
        : "No verified official updates were available from the configured entries";
      if (rawItems.length) {
        source.lastSuccessfulAt = new Date().toISOString();
      }
      if (DEBUG_FETCH) {
        console.log(`[fetch] ${source.name}: ${rawItems.length} items`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      source.lastFetchStatus = "error";
      source.lastFetchMessage = message;
      if (DEBUG_FETCH) {
        console.log(`[fetch] ${source.name}: failed`);
      }
    }
    source.lastFetchedAt = new Date().toISOString();
  }

  nextSignals.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

  const updatedStore = {
    sources: allSources.map((source) => sources.find((candidate) => candidate.id === source.id) ?? source),
    signals: nextSignals.slice(0, 200),
    trendSummary: generateTrendSummary(nextSignals),
    lastUpdatedAt: new Date().toISOString()
  };

  await writeStore(updatedStore);
  await writeRadarExports(updatedStore);
  return updatedStore;
}

export async function refreshRadarDataWithOptions(options: RefreshOptions = {}) {
  const store = await readStore();
  const sources = (store.sources.length ? store.sources : defaultSources)
    .filter((source) => source.active)
    .filter((source) => (options.sourceIds?.length ? options.sourceIds.includes(source.id) : true))
    .filter((source) => (options.excludeSourceIds?.length ? !options.excludeSourceIds.includes(source.id) : true));
  return runRefreshForSources(store, sources);
}
