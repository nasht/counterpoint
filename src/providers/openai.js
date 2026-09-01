import { ProviderError, httpError, networkError } from "./index.js";

// OpenAI-compatible chat completions. Also used by openrouter.js and any
// custom baseUrl the user points at an OpenAI-compatible server.
export async function chatCompletions(opts) {
  // Many small/free models and self-hosted OpenAI-compatible servers reject
  // response_format with a 400. Retry once without it rather than failing.
  try {
    return await post(opts, true);
  } catch (e) {
    if (e.status === 400 && /response_format|json_object|not supported/i.test(e.detail ?? "")) {
      return post(opts, false);
    }
    throw e;
  }
}

async function post({ model, apiKey, baseUrl, system, user, signal, extraHeaders = {} }, withJsonMode) {
  let res;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        ...(withJsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (e) {
    throw networkError(e);
  }
  if (!res.ok) throw await httpError(res);
  const data = await res.json();
  const choice = data.choices?.[0];
  const text = choice?.message?.content;
  if (!text) throw new ProviderError("bad_response", "Empty response from provider.");
  if (choice.finish_reason === "length") {
    throw new ProviderError(
      "context_length",
      "The model ran out of output space before finishing its analysis. Try a shorter article or select just the part you care about."
    );
  }
  return { text, usage: data.usage ?? null };
}

export async function call(opts) {
  if (!opts.apiKey) throw new ProviderError("auth", "No OpenAI API key set.");
  return chatCompletions(opts);
}
