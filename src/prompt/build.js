import { api } from "../lib/env.js";
import { DEFAULT_SYSTEM_PROMPT } from "./defaults.js";

// The output contract is appended to the user message by code so a
// user-edited system prompt cannot break JSON parsing.
const OUTPUT_CONTRACT = `Respond with ONLY a JSON object (no markdown fence, no prose before or after) in exactly this shape:

{
  "summary": "one-sentence neutral summary of what the article reports",
  "claims": [{"text": "...", "type": "fact" | "interpretation"}],
  "frame": {
    "centred": "whose interests/viewpoint the article centres",
    "missing": "who is affected but absent or marginal",
    "notes": "anything notable about placement or emphasis"
  },
  "bias": {
    "framing":  {"score": 0, "why": "..."},
    "sourcing": {"score": 0, "why": "..."},
    "emphasis": {"score": 0, "why": "..."},
    "language": {"score": 0, "why": "..."}
  },
  "strongest_point": "the article's single strongest, fairest point",
  "voices": [
    {
      "owner": "the specific constituency holding this reading",
      "reading": "their genuine interpretation of the same facts, 2-4 sentences",
      "grounded_in": "the fact(s) from the article this reading rests on"
    }
  ],
  "no_voices_reason": null
}

Scores are integers 0-4. If there are no legitimate alternative voices, use "voices": [] and set "no_voices_reason" to a short explanation.`;

export async function getSystemPrompt() {
  const { cp_system_prompt } = await api.storage.local.get("cp_system_prompt");
  return cp_system_prompt || DEFAULT_SYSTEM_PROMPT;
}

export async function setSystemPrompt(text) {
  if (!text || text.trim() === DEFAULT_SYSTEM_PROMPT.trim()) {
    await api.storage.local.remove("cp_system_prompt");
  } else {
    await api.storage.local.set({ cp_system_prompt: text });
  }
}

export function buildUserMessage(article) {
  const meta = [
    article.title && `Title: ${article.title}`,
    article.byline && `Byline: ${article.byline}`,
    article.siteName && `Publication: ${article.siteName}`,
    article.published && `Published: ${article.published}`,
    article.url && `URL: ${article.url}`,
    article.truncated && `NOTE: only a partial extraction was available (paywall or truncation); analyse what is here and do not speculate about the rest.`,
  ]
    .filter(Boolean)
    .join("\n");

  return `Analyse this article.\n\n${meta}\n\n---\n${article.text}\n---\n\n${OUTPUT_CONTRACT}`;
}

// Tolerant JSON extraction: models occasionally wrap output in a fence or a
// sentence despite instructions.
export function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new Error("Model response contained no JSON object");
    }
    return JSON.parse(text.slice(start, end + 1));
  }
}
