import { api, IS_FIREFOX } from "../lib/env.js";
import { getKey } from "../lib/keys.js";
import { cacheKey, cacheGet, cacheSet } from "../lib/cache.js";
import { getSystemPrompt, buildUserMessage, extractJson } from "../prompt/build.js";
import { runAnalysis, PROVIDERS, ProviderError } from "../providers/index.js";

// Toolbar button opens the panel: Chrome side panel / Firefox sidebar.
if (IS_FIREFOX) {
  api.action.onClicked.addListener(() => api.sidebarAction.open());
} else {
  api.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

async function extractArticle(tabId) {
  await api.scripting.executeScript({
    target: { tabId },
    files: ["vendor/Readability.js", "src/content/extract.js"],
  });
  const res = await api.tabs.sendMessage(tabId, { type: "CP_EXTRACT" });
  if (!res?.ok) throw new Error(res?.error ?? "Extraction failed.");
  return res.article;
}

async function analyse({ tabId, force }) {
  const { cp_settings: settings = {} } = await api.storage.local.get("cp_settings");
  const provider = settings.provider ?? "anthropic";
  const p = PROVIDERS[provider];
  const model = settings.model || p.defaultModel;

  const apiKey = await getKey(provider);
  if (p.needsKey && !apiKey) {
    throw new ProviderError("auth", `No API key set for ${p.label}. Add one in Settings.`);
  }

  const article = await extractArticle(tabId);
  const system = await getSystemPrompt();

  const key = await cacheKey(article.url, `${provider}/${model}`, system);
  if (!force) {
    const cached = await cacheGet(key);
    if (cached) return { article: summariseArticle(article), analysis: cached, cached: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  let text;
  try {
    ({ text } = await runAnalysis({
      provider,
      model,
      apiKey,
      baseUrl: settings.baseUrl || undefined,
      system,
      user: buildUserMessage(article),
      signal: controller.signal,
    }));
  } finally {
    clearTimeout(timer);
  }

  const analysis = extractJson(text);
  await cacheSet(key, analysis);
  return { article: summariseArticle(article), analysis, cached: false };
}

// What the panel needs to display; not the full body.
function summariseArticle(a) {
  return {
    title: a.title,
    byline: a.byline,
    siteName: a.siteName,
    url: a.url,
    source: a.source,
    truncated: a.truncated,
    chars: a.text.length,
  };
}

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "CP_ANALYSE") return false;
  analyse(msg)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((e) =>
      sendResponse({
        ok: false,
        error: e.message ?? String(e),
        kind: e instanceof ProviderError ? e.kind : "internal",
      })
    );
  return true; // async sendResponse
});
