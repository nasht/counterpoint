import * as anthropic from "./anthropic.js";
import * as openai from "./openai.js";
import * as openrouter from "./openrouter.js";
import * as ollama from "./ollama.js";
import { api } from "../lib/env.js";

// Free OpenRouter models to try in order when the user hasn't set a model.
// Some :free slugs are gated to specific apps or get retired with no
// machine-readable signal, so the default walks this list and remembers
// whichever model actually answered.
export const FREE_FALLBACKS = [
  "nvidia/nemotron-3.5-lightning:free",
  "thinkingmachines/inkling-small:free",
  "liquid/lfm-2.5-2.6b:free",
  "poolside/laguna-s-2.1:free",
];

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
    // A capable no-cost model; the Settings tab offers the live :free list.
    defaultModel: FREE_FALLBACKS[0],
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

export async function runAnalysis({ provider, model, apiKey, baseUrl, system, user, signal, onProgress = () => {} }) {
  const p = PROVIDERS[provider];
  if (!p) throw new ProviderError("bad_response", `Unknown provider: ${provider}`);

  // Blank model + OpenRouter: self-healing free default.
  if (!model && provider === "openrouter") {
    return callWithFreeFallbacks(p, { apiKey, baseUrl: baseUrl || p.defaultBaseUrl, system, user, signal }, onProgress);
  }

  const resolvedModel = model || p.defaultModel;
  if (!resolvedModel) throw new ProviderError("bad_response", "No model configured - set one in Settings.");
  onProgress(`Asking ${resolvedModel}…`);
  return p.call({
    model: resolvedModel,
    apiKey,
    baseUrl: baseUrl || p.defaultBaseUrl,
    system,
    user,
    signal,
  });
}

async function callWithFreeFallbacks(p, opts, onProgress) {
  const { cp_or_free_model } = await api.storage.local.get("cp_or_free_model");
  const candidates = [...new Set([cp_or_free_model, ...FREE_FALLBACKS].filter(Boolean))];
  let lastError = null;
  for (const model of candidates) {
    try {
      onProgress(`Asking ${model}… (free models can be slow)`);
      const result = await p.call({ ...opts, model });
      if (model !== cp_or_free_model) await api.storage.local.set({ cp_or_free_model: model });
      return { ...result, model };
    } catch (e) {
      if (e instanceof ProviderError && e.kind === "model_gated") {
        lastError = e;
        onProgress(`${model} unavailable - trying the next free model…`);
        continue; // gated or retired slug - try the next free model
      }
      throw e;
    }
  }
  throw new ProviderError(
    "model_gated",
    `None of the default free models are currently available (${lastError?.message ?? "no detail"}). Pick a model explicitly in Settings.`
  );
}

// Shared helper: map an HTTP failure to a ProviderError.
export async function httpError(res) {
  let detail = "";
  try {
    detail = (await res.text()).slice(0, 500);
  } catch {
    /* ignore */
  }
  // Not an auth problem: some hosted models are gated to specific apps, and
  // retired slugs 404 - both mean "this model, not your key".
  if ((res.status === 403 || res.status === 404) && /model|harness|endpoint/i.test(detail)) {
    return new ProviderError("model_gated", `This model isn't available to plain API callers (${res.status}). ${detail}`);
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
