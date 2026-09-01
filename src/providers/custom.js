import { ProviderError } from "./index.js";
import { chatCompletions } from "./openai.js";

// Any OpenAI-compatible server the user points at. No default base URL -
// the whole point is that the user supplies it - so fail with a clear
// message rather than fetching "undefined/chat/completions".
export async function call(opts) {
  if (!opts.baseUrl) {
    throw new ProviderError("bad_response", "Set a Base URL in Settings for the custom provider (e.g. https://my-server.example/v1).");
  }
  return chatCompletions(opts);
}
