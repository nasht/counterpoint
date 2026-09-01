import { ProviderError, httpError, networkError } from "./index.js";

// Direct browser->API calls need the dangerous-direct-browser-access header,
// otherwise CORS blocks requests from an extension origin. The key is the
// user's own and never leaves their machine except to Anthropic.
export async function call({ model, apiKey, baseUrl, system, user, signal }) {
  if (!apiKey) throw new ProviderError("auth", "No Anthropic API key set.");
  let res;
  try {
    res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
  } catch (e) {
    throw networkError(e);
  }
  if (!res.ok) throw await httpError(res);
  const data = await res.json();
  if (data.stop_reason === "refusal") {
    throw new ProviderError("refusal", "The model declined to analyse this article.");
  }
  if (data.stop_reason === "max_tokens") {
    throw new ProviderError(
      "context_length",
      "The model ran out of output space before finishing its analysis. Try a shorter article or select just the part you care about."
    );
  }
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (!text) throw new ProviderError("bad_response", "Empty response from Anthropic.");
  return { text, usage: data.usage ?? null };
}
