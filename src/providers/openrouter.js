import { ProviderError } from "./index.js";
import { chatCompletions } from "./openai.js";

// OpenRouter speaks the OpenAI wire format; it's how users bring any model
// not covered by the other adapters.
export async function call(opts) {
  if (!opts.apiKey) throw new ProviderError("auth", "No OpenRouter API key set.");
  return chatCompletions({
    ...opts,
    extraHeaders: {
      "HTTP-Referer": "https://github.com/nasht/counterpoint",
      "X-Title": "Counterpoint",
    },
  });
}
