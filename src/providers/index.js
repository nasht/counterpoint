import * as anthropic from "./anthropic.js";
import * as openai from "./openai.js";
import * as openrouter from "./openrouter.js";
import * as ollama from "./ollama.js";

// Normalised error taxonomy - the UI recovers differently for each kind.
export class ProviderError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = "ProviderError";
    this.kind = kind; // auth | rate_limit | context_length | network | refusal | bad_response
  }
}

export const PROVIDERS = {
  anthropic: {
    label: "Anthropic",
    needsKey: true,
    defaultModel: "claude-opus-5",
    defaultBaseUrl: "https://api.anthropic.com",
    call: anthropic.call,
  },
  openai: {
    label: "OpenAI",
    needsKey: true,
    defaultModel: "gpt-4o",
    defaultBaseUrl: "https://api.openai.com/v1",
    call: openai.call,
  },
  openrouter: {
    label: "OpenRouter",
    needsKey: true,
    defaultModel: "",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    call: openrouter.call,
  },
  ollama: {
    label: "Ollama (local)",
    needsKey: false,
    defaultModel: "llama3.1",
    defaultBaseUrl: "http://localhost:11434",
    call: ollama.call,
  },
};

export async function runAnalysis({ provider, model, apiKey, baseUrl, system, user, signal }) {
  const p = PROVIDERS[provider];
  if (!p) throw new ProviderError("bad_response", `Unknown provider: ${provider}`);
  const resolvedModel = model || p.defaultModel;
  if (!resolvedModel) throw new ProviderError("bad_response", "No model configured - set one in Settings.");
  return p.call({
    model: resolvedModel,
    apiKey,
    baseUrl: baseUrl || p.defaultBaseUrl,
    system,
    user,
    signal,
  });
}

// Shared helper: map an HTTP failure to a ProviderError.
export async function httpError(res) {
  let detail = "";
  try {
    detail = (await res.text()).slice(0, 500);
  } catch {
    /* ignore */
  }
  if (res.status === 401 || res.status === 403) {
    return new ProviderError("auth", `Authentication failed (${res.status}). Check your API key. ${detail}`);
  }
  if (res.status === 429) {
    return new ProviderError("rate_limit", `Rate limited (429). Wait a moment and retry. ${detail}`);
  }
  if (res.status === 400 && /context|too long|maximum.*tokens|token limit/i.test(detail)) {
    return new ProviderError("context_length", `The article is too long for this model's context window. ${detail}`);
  }
  return new ProviderError("network", `Provider returned ${res.status}. ${detail}`);
}

export function networkError(e, hint = "") {
  if (e.name === "AbortError") return new ProviderError("network", "Request cancelled or timed out.");
  return new ProviderError("network", `Could not reach the provider: ${e.message}. ${hint}`.trim());
}
