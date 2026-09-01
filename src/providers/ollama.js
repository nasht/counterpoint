import { ProviderError, httpError, networkError } from "./index.js";

// Local Ollama - the no-key, fully-private option.
export async function call({ model, baseUrl, system, user, signal }) {
  let res;
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        // Hybrid reasoning models (Qwen3) otherwise spend the whole budget
        // thinking and return no JSON at all.
        think: false,
        options: {
          // Without a cap a small model can loop and emit JSON until it fills
          // the context - observed with gemma3:4b, which ran past 6,000 tokens
          // and only stopped on timeout. The OpenAI path already caps this.
          num_predict: 4096,
        },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (e) {
    throw networkError(
      e,
      "If Ollama is running, it may be blocking extension origins - restart it with OLLAMA_ORIGINS='*' (or 'chrome-extension://*,moz-extension://*')."
    );
  }
  if (!res.ok) throw await httpError(res);
  const data = await res.json();
  const text = data.message?.content;
  if (!text) throw new ProviderError("bad_response", "Empty response from Ollama.");
  return { text, usage: null };
}
