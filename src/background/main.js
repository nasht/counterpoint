import { api, IS_FIREFOX } from "../lib/env.js";
import { getKey } from "../lib/keys.js";
import { cacheKey, cacheGet, cacheSet } from "../lib/cache.js";
import { getSystemPrompt, buildUserMessage, extractJson } from "../prompt/build.js";
import { runAnalysis, PROVIDERS, ProviderError } from "../providers/index.js";

// Toolbar button opens the panel: Chrome side panel / Firefox sidebar.
// Belt and braces - some Chromium forks honour the declarative behaviour but
// not sidePanel.open() from onClicked, others the reverse. Register both;
// whichever path works wins, and double-opening is harmless.
api.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch((e) => console.error("setPanelBehavior:", e));
api.action.onClicked.addListener((tab) => {
  // Must be the synchronous first call - these APIs only allow opening from a
  // user gesture, and awaiting anything first loses the gesture.
  if (IS_FIREFOX) {
    api.sidebarAction.open();
  } else {
    api.sidePanel.open({ windowId: tab.windowId }).catch((e) => console.error("sidePanel.open failed:", e));
  }
});

// Progress events for the panel's status line; fire-and-forget (the panel
// may be closed, and nothing must depend on a reply).
function progress(text) {
  api.runtime.sendMessage({ type: "CP_PROGRESS", text }).catch(() => {});
}

async function extractArticle(tabId) {
  progress("Reading the article…");
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
  const provider = settings.provider ?? "openrouter";
  const p = PROVIDERS[provider];
  // Leave the model blank when unset - runAnalysis resolves the default and,
  // for OpenRouter, walks the free-model fallbacks.
  const model = settings.model || "";

  const apiKey = await getKey(provider);
  if (p.needsKey && !apiKey) {
    throw new ProviderError("auth", `No API key set for ${p.label}. Add one in Settings.`);
  }

  const article = await extractArticle(tabId);
  const system = await getSystemPrompt();

  const key = await cacheKey(article.url, `${provider}/${model || "default"}`, system);
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
      onProgress: progress,
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
