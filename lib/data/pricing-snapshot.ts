export interface PriceSnapshotEntry {
  company: string;
  anchorLabel: string;
  product: string;
  headlinePrice: string;
  secondaryPrice?: string;
  basis: string;
  note: string;
  sourceUrl: string;
  verifiedAt: string;
}

export const pricingSnapshot: PriceSnapshotEntry[] = [
  {
    company: "OpenAI",
    anchorLabel: "Flagship",
    product: "GPT-5.5",
    headlinePrice: "$5 / 1M input",
    secondaryPrice: "$30 / 1M output",
    basis: "API token",
    note: "",
    sourceUrl: "https://openai.com/api/pricing/",
    verifiedAt: "2026-06-02T00:00:00.000Z"
  },
  {
    company: "Anthropic",
    anchorLabel: "Flagship",
    product: "Claude Opus 4.8",
    headlinePrice: "$5 / MTok input",
    secondaryPrice: "$25 / MTok output",
    basis: "API token",
    note: "",
    sourceUrl: "https://platform.claude.com/docs/en/about-claude/pricing",
    verifiedAt: "2026-06-02T00:00:00.000Z"
  },
  {
    company: "Google",
    anchorLabel: "Flagship",
    product: "Gemini 3.5 Flash",
    headlinePrice: "$1.50 / 1M input",
    secondaryPrice: "$9 / 1M output",
    basis: "API token",
    note: "",
    sourceUrl: "https://ai.google.dev/gemini-api/docs/pricing",
    verifiedAt: "2026-06-02T00:00:00.000Z"
  },
  {
    company: "DeepSeek",
    anchorLabel: "Flagship",
    product: "DeepSeek-V4-Pro",
    headlinePrice: "$0.435 / 1M input",
    secondaryPrice: "$0.87 / 1M output",
    basis: "API token",
    note: "",
    sourceUrl: "https://api-docs.deepseek.com/quick_start/pricing",
    verifiedAt: "2026-06-02T00:00:00.000Z"
  },
  {
    company: "MiniMax",
    anchorLabel: "Flagship",
    product: "MiniMax-M2.7-highspeed",
    headlinePrice: "$0.6 / 1M input",
    secondaryPrice: "$2.4 / 1M output",
    basis: "API token",
    note: "",
    sourceUrl: "https://platform.minimax.io/docs/guides/pricing-paygo",
    verifiedAt: "2026-06-02T00:00:00.000Z"
  },
  {
    company: "豆包 / 方舟",
    anchorLabel: "Flagship",
    product: "Agent Plan Max",
    headlinePrice: "1000元 / 月",
    secondaryPrice: "Large 500 / Medium 200",
    basis: "Subscription",
    note: "",
    sourceUrl: "https://www.volcengine.com/docs/82379/2366394?lang=zh",
    verifiedAt: "2026-06-02T00:00:00.000Z"
  }
];
