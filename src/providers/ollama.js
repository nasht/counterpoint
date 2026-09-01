import { ProviderError, httpError, networkError } from "./index.js";

// Local Ollama - the no-key, fully-private option.

async function installedModels(baseUrl, signal) {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal });
    if (!res.ok) return [];
    const { models = [] } = await res.json();
    return models.map((m) => m.name).filter(Boolean);
  } catch {
    return [];
  }
}

export async function call({ model, baseUrl, system, user, signal }) {
  // Blank model: use whatever is actually installed rather than a hardcoded
  // slug the user has never pulled.
  if (!model) {
    const [first] = await installedModels(baseUrl, signal);
    if (!first) {
      throw new ProviderError(
        "bad_response",
        "Ollama has no models installed. Pull one first, e.g. `ollama pull qwen3:8b`, then set it in Settings."
      );
    }
    model = first;
  }
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
  if (!res.ok) {
    // Ollama 404s an un-pulled model. The shared classifier reads that as
    // "gated to specific apps", which is meaningless for a local server -
    // say what actually happened and what is available instead.
    if (res.status === 404) {
      const have = await installedModels(baseUrl, signal);
      throw new ProviderError(
        "bad_response",
        `Ollama has no model "${model}". Pull it with \`ollama pull ${model}\`` +
          (have.length ? `, or pick one you have: ${have.join(", ")}.` : ".")
      );
    }
    throw await httpError(res);
  }
  const data = await res.json();
  const text = data.message?.content;
  if (!text) throw new ProviderError("bad_response", "Empty response from Ollama.");
  return { text, usage: null };
}
