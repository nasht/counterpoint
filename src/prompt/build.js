import { api } from "../lib/env.js";
import { DEFAULT_SYSTEM_PROMPT } from "./defaults.js";

// The output contract is appended to the user message by code so a
// user-edited system prompt cannot break JSON parsing.
const OUTPUT_CONTRACT = `Respond with ONLY a JSON object (no markdown fence, no prose before or after) in exactly this shape:

{
  "summary": "",
  "claims": [{"text": "", "type": "fact"}],
  "frame": {"centred": "", "missing": "", "notes": ""},
  "bias": {
    "framing":  {"score": 0, "why": ""},
    "sourcing": {"score": 0, "why": ""},
    "emphasis": {"score": 0, "why": ""},
    "language": {"score": 0, "why": ""}
  },
  "strongest_point": "",
  "intent": {"reads_as": "<one of: inform, explain, persuade, provoke, promote>", "emotion": "", "why": ""},
  "voices": [{"owner": "", "reading": "", "grounded_in": ""}],
  "no_voices_reason": null
}

Every string above is an empty slot for YOU to fill with content about THIS article. The field guide below describes what belongs in each slot - it is a description, not text to copy. Never emit any wording from the field guide as a value.

FIELD GUIDE
- summary: one neutral sentence on what the article reports.
- claims[].text: an assertion the article makes. claims[].type: "fact" or "interpretation".
- frame.centred: whose interests or viewpoint the article centres. frame.missing: who is affected but absent or marginal. frame.notes: anything notable about placement or emphasis.
- bias.*.score: an integer 0-4, where 0 is exemplary and 4 is severe. bias.*.why: a short quote or concrete observation justifying it.
- strongest_point: the article's single strongest, fairest point.
- intent.reads_as: EXACTLY one of these five lowercase words and nothing else: inform, explain, persuade, provoke, promote. Not a sentence, not a phrase, not two of them joined. Put your reasoning in intent.why instead. intent.emotion: the specific feeling the piece is built to produce, or null if it is not working on the reader's feelings. intent.why: what in the writing supports that reading.
- voices[].owner: a named constituency drawn from THIS article's own subject matter - the people it actually concerns. Do not borrow a group from these instructions.
- voices[].reading: 2-4 sentences giving that constituency's reading of the same facts. Write it in the third person, attributed to that group, in this register: "<GROUP> may well welcome <X>, because...", "<GROUP> could read this as <X>, given...", "<GROUP> are likely to see <X> as...". The angle brackets mark slots to fill from the article; the register is what to copy, never the wording. Never first person, never addressed to the reader, never asserted as fact.
- voices[].grounded_in: the fact(s) from the article the reading rests on.
- no_voices_reason: null when there are voices; when "voices" is [], a short explanation instead.

Never return an empty string: if a field genuinely does not apply, use null, or omit the object from its array. An unfilled skeleton is not a valid answer.

Before you answer, check two things: that no value repeats wording from the field guide, and that intent.reads_as is one of the five permitted words.`;

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
