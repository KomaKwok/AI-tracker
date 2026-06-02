import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { RadarStore, Signal } from "@/lib/types";

const exportDir = path.join(process.cwd(), "data", "exports");
const markdownFile = path.join(exportDir, "latest-links-zh.md");
const jsonFile = path.join(exportDir, "latest-links.json");

function formatDate(value: string) {
  return format(new Date(value), "yyyy-MM-dd HH:mm", { locale: zhCN });
}

function buildSignalLine(signal: Signal) {
  return [
    `- [${signal.title}](${signal.url})`,
    `  - 公司: ${signal.company}`,
    `  - 来源: ${signal.sourceName} / ${signal.sourceType} / ${signal.region}`,
    `  - 发布时间: ${formatDate(signal.publishedAt)}`,
    `  - 标签: ${signal.tags.join(", ")}`,
    `  - 评分: 一手 ${signal.firstHandScore} / 热度 ${signal.heatScore} / 综合 ${signal.signalScore}`,
    `  - 摘要: ${signal.summary}`
  ].join("\n");
}

function buildMarkdown(store: RadarStore) {
  const signals = [...store.signals].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  const topSignals = signals.slice(0, 10);
  const chinaSignals = signals.filter((signal) => signal.region === "China");
  const globalSignals = signals.filter((signal) => signal.region === "Global");

  const tagCounts = new Map<string, number>();
  for (const signal of signals) {
    for (const tag of signal.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const promptBlock = [
    "你是一名中文 AI 产品研究助理。请阅读我下面整理的一组一手 AI 产品动态链接，并输出：",
    "1. 用中文总结每条链接最关键的产品更新",
    "2. 判断哪些是真正的一手官方产品信号，哪些只是生态热度",
    "3. 按照 Agent、Coding、Search、Multimodal、Open Source、Enterprise、Model Release 分类",
    "4. 最后给我一段“中国 vs 全球 AI 产品动态差异”的中文总结",
    "5. 如果有重复或低价值信号，请帮我去重"
  ].join("\n");

  return [
    "# AI Radar 中文阅读包",
    "",
    `生成时间: ${store.lastUpdatedAt ? formatDate(store.lastUpdatedAt) : "未生成"}`,
    `信号总数: ${signals.length}`,
    "",
    "## 这份文档怎么用",
    "",
    "这份文档按类别整理了最近抓到的 AI 产品动态链接。你可以直接把整份 Markdown 贴给任意 AI，让它替你做中文阅读、归纳和对比分析。",
    "",
    "## 可直接复制给 AI 的提示词",
    "",
    "```text",
    promptBlock,
    "```",
    "",
    "## 高优先级信号",
    "",
    ...topSignals.map(buildSignalLine),
    "",
    "## 热门主题",
    "",
    ...topTags.map(([tag, count]) => `- ${tag}: ${count} 条信号`),
    "",
    "## 全球市场",
    "",
    ...(globalSignals.length ? globalSignals.map(buildSignalLine) : ["- 暂无"]),
    "",
    "## 中国市场",
    "",
    ...(chinaSignals.length ? chinaSignals.map(buildSignalLine) : ["- 暂无"]),
    "",
    "## 最近 7 天趋势",
    "",
    ...store.trendSummary.last7d.map((trend) => `- ${trend.label}: ${trend.summary} (${trend.count} 条)`),
    "",
    "## 最近 30 天趋势",
    "",
    ...store.trendSummary.last30d.map((trend) => `- ${trend.label}: ${trend.summary} (${trend.count} 条)`),
    "",
    "## 中国 vs 全球",
    "",
    store.trendSummary.chinaVsGlobal,
    ""
  ].join("\n");
}

export async function writeRadarExports(store: RadarStore) {
  await mkdir(exportDir, { recursive: true });
  await writeFile(markdownFile, buildMarkdown(store), "utf8");
  await writeFile(jsonFile, JSON.stringify(store, null, 2), "utf8");

  return {
    markdownFile,
    jsonFile
  };
}
