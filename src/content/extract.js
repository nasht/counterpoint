// Injected on demand (after vendor/Readability.js) via scripting.executeScript.
// Plain script, not a module - content scripts can't be ES modules.
(() => {
  if (window.__cpExtractLoaded) return;
  window.__cpExtractLoaded = true;

  const api = globalThis.browser ?? globalThis.chrome;
  const MIN_LENGTH = 500;

  function fromJsonLd() {
    for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        let data = JSON.parse(el.textContent);
        const items = Array.isArray(data) ? data : data["@graph"] ?? [data];
        for (const item of items) {
          const type = [].concat(item["@type"] ?? []);
          if (type.some((t) => /Article/i.test(t)) && item.articleBody) {
            return {
              title: item.headline ?? document.title,
              byline: item.author?.name ?? [].concat(item.author ?? [])[0]?.name ?? null,
              siteName: item.publisher?.name ?? null,
              published: item.datePublished ?? null,
              text: item.articleBody,
            };
          }
        }
      } catch {
        /* malformed JSON-LD is everywhere; skip */
      }
    }
    return null;
  }

  function fromReadability() {
    try {
      const doc = document.cloneNode(true);
      const article = new Readability(doc).parse();
      if (!article?.textContent) return null;
      return {
        title: article.title,
        byline: article.byline,
        siteName: article.siteName,
        published: article.publishedTime ?? null,
        text: article.textContent.replace(/\n{3,}/g, "\n\n").trim(),
      };
    } catch {
      return null;
    }
  }

  function fromDom() {
    const el =
      document.querySelector("article") ??
      document.querySelector('[role="main"]') ??
      document.querySelector("main");
    if (!el) return null;
    return { title: document.title, byline: null, siteName: null, published: null, text: el.innerText.trim() };
  }

  function extract() {
    // User-selected text wins - it's the "Counterpoint this selection" path.
    const selection = window.getSelection()?.toString().trim();
    if (selection && selection.length > 200) {
      return { title: document.title, byline: null, siteName: null, published: null, text: selection, source: "selection" };
    }

    const candidates = [
      { ...fromReadability(), source: "readability" },
      { ...fromJsonLd(), source: "jsonld" },
      { ...fromDom(), source: "dom" },
    ].filter((c) => c.text);

    // Prefer the first candidate that clears the length bar, else the longest.
    let best = candidates.find((c) => c.text.length >= MIN_LENGTH);
    if (!best) best = candidates.sort((a, b) => (b.text?.length ?? 0) - (a.text?.length ?? 0))[0];
    return best ?? null;
  }

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "CP_EXTRACT") return;
    const result = extract();
    if (!result) {
      sendResponse({ ok: false, error: "Could not find article text on this page." });
      return;
    }
    const MAX_CHARS = 60000; // ~15k tokens; enough for any news article
    const truncatedByUs = result.text.length > MAX_CHARS;
    sendResponse({
      ok: true,
      article: {
        ...result,
        url: location.href,
        text: truncatedByUs ? result.text.slice(0, MAX_CHARS) : result.text,
        // Short extraction usually means a paywall showed us only the standfirst.
        truncated: truncatedByUs || result.text.length < MIN_LENGTH,
      },
    });
  });
})();
