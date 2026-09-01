import { ProviderError } from "./index.js";
import { chatCompletions } from "./openai.js";

// Google Gemini via its OpenAI-compatible endpoint. AI Studio keys
// (aistudio.google.com/apikey) have a free tier.
export async function call(opts) {
  if (!opts.apiKey) throw new ProviderError("auth", "No Gemini API key set.");
  return chatCompletions(opts);
}
