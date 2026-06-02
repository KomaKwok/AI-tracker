import { summarizeSnippet, suggestTags } from "@/lib/ai/fallback";
import { Tag } from "@/lib/types";

interface AiResult {
  summary: string;
  tags: Tag[];
}

interface ProviderConfig {
  name: string;
  apiKey: string;
  model: string;
  url: string;
}

function getProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      url: "https://api.openai.com/v1/responses"
    });
  }

  if (process.env.DEEPSEEK_API_KEY) {
    providers.push({
      name: "deepseek",
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      url: `${process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"}/chat/completions`
    });
  }

  return providers;
}

async function callOpenAiLikeProvider(provider: ProviderConfig, title: string, snippet: string): Promise<AiResult> {
  if (provider.name === "openai") {
    const response = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model: provider.model,
        input: [
          {
            role: "system",
            content:
              "You summarize first-hand AI product updates in one sentence and suggest up to four tags from: Agent, Coding, Search, Multimodal, Open Source, Enterprise, Model Release, API, Infrastructure. Return JSON with summary and tags."
          },
          {
            role: "user",
            content: `Title: ${title}\nSnippet: ${snippet}`
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "signal_enrichment",
            schema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                tags: {
                  type: "array",
                  items: { type: "string" }
                }
              },
              required: ["summary", "tags"],
              additionalProperties: false
            }
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI error ${response.status}`);
    }

    const payload = await response.json();
    const raw = payload.output?.[0]?.content?.[0]?.text;
    if (!raw) {
      throw new Error("Missing OpenAI response payload");
    }

    const parsed = JSON.parse(raw) as AiResult;
    return {
      summary: parsed.summary,
      tags: parsed.tags.slice(0, 4) as Tag[]
    };
  }

  const response = await fetch(provider.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You summarize first-hand AI product updates in one sentence and suggest up to four tags from: Agent, Coding, Search, Multimodal, Open Source, Enterprise, Model Release, API, Infrastructure. Return a JSON object with summary and tags."
        },
        {
          role: "user",
          content: `Title: ${title}\nSnippet: ${snippet}`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek error ${response.status}`);
  }

  const payload = await response.json();
  const raw = payload.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error("Missing DeepSeek response payload");
  }

  const parsed = JSON.parse(raw) as AiResult;
  return {
    summary: parsed.summary,
    tags: parsed.tags.slice(0, 4) as Tag[]
  };
}

export async function enrichSignalWithAi(input: {
  title: string;
  snippet: string;
}): Promise<AiResult> {
  const providers = getProviders();

  for (const provider of providers) {
    try {
      return await callOpenAiLikeProvider(provider, input.title, input.snippet);
    } catch {}
  }

  return {
    summary: summarizeSnippet(input.title, input.snippet),
    tags: suggestTags(input.title, input.snippet)
  };
}
