import { ProviderError, httpError, networkError } from "./index.js";

// OpenAI-compatible chat completions. Also used by openrouter.js and any
// custom baseUrl the user points at an OpenAI-compatible server.
export async function chatCompletions({ model, apiKey, baseUrl, system, user, signal, extraHeaders = {} }) {
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
        response_format: { type: "json_object" },
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
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new ProviderError("bad_response", "Empty response from provider.");
  return { text, usage: data.usage ?? null };
}

export async function call(opts) {
  if (!opts.apiKey) throw new ProviderError("auth", "No OpenAI API key set.");
  return chatCompletions(opts);
}
