import { ProviderError } from "./index.js";
import { chatCompletions } from "./openai.js";

// DeepSeek speaks the OpenAI wire format.
export async function call(opts) {
  if (!opts.apiKey) throw new ProviderError("auth", "No DeepSeek API key set.");
  return chatCompletions(opts);
}
