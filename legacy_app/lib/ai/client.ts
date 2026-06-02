import { summarizeSnippet, suggestTags } from "@/lib/ai/fallback";
import { Tag } from "@/lib/types";

interface AiResult {
  summary: string;
  tags: Tag[];
}

export async function enrichSignalWithAi(input: {
  title: string;
  snippet: string;
}): Promise<AiResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      summary: summarizeSnippet(input.title, input.snippet),
      tags: suggestTags(input.title, input.snippet)
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You summarize first-hand AI product updates in one sentence and suggest up to four tags from: Agent, Coding, Search, Multimodal, Open Source, Enterprise, Model Release, API, Infrastructure. Return JSON with summary and tags."
          },
          {
            role: "user",
            content: `Title: ${input.title}\nSnippet: ${input.snippet}`
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
      throw new Error("Missing response payload");
    }

    const parsed = JSON.parse(raw) as AiResult;
    return {
      summary: parsed.summary,
      tags: parsed.tags.slice(0, 4) as Tag[]
    };
  } catch {
    return {
      summary: summarizeSnippet(input.title, input.snippet),
      tags: suggestTags(input.title, input.snippet)
    };
  }
}
