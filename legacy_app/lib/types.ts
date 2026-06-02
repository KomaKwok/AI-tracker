export type Region = "Global" | "China";

export type SourceType =
  | "Official"
  | "GitHub"
  | "HN"
  | "Product Hunt"
  | "Developer Ecosystem";

export type Tag =
  | "Agent"
  | "Coding"
  | "Search"
  | "Multimodal"
  | "Open Source"
  | "Enterprise"
  | "Model Release"
  | "API"
  | "Infrastructure";

export interface Signal {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  sourceType: SourceType;
  company: string;
  region: Region;
  publishedAt: string;
  fetchedAt: string;
  summary: string;
  tags: Tag[];
  firstHandScore: number;
  heatScore: number;
  signalScore: number;
  rawContentSnippet: string;
  dedupeHash: string;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  feedUrls?: string[];
  fallbackUrls?: string[];
  sitemapUrl?: string;
  region: Region;
  sourceType: SourceType;
  priority: number;
  fetchStrategy: string;
  active: boolean;
  lastFetchedAt: string | null;
  lastSuccessfulAt?: string | null;
  lastFetchStatus?: "success" | "empty" | "error";
  lastFetchMessage?: string | null;
}

export interface TrendPoint {
  label: string;
  summary: string;
  count: number;
}

export interface TrendSummary {
  generatedAt: string;
  last7d: TrendPoint[];
  last30d: TrendPoint[];
  chinaVsGlobal: string;
}

export interface RadarStore {
  sources: Source[];
  signals: Signal[];
  trendSummary: TrendSummary;
  lastUpdatedAt: string | null;
}
