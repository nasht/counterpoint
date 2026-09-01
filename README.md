# Counterpoint

*Every story has another line.*

A free, open-source browser extension (Chrome + Firefox) that analyses the news
article you're reading for framing and bias, then offers **voices** - readings
of the same facts that other, specific constituencies would genuinely hold.
Not debunking, not contrarianism: the letters page the article never printed.

Bring your own model. Your API key, your provider, your prompt. Nothing ever
passes through anyone's server but your model provider's.

## What it does

- **Lens check** - four independent 0-4 ratings (framing, sourcing, emphasis,
  language), each justified with a quote from the article. Deliberately *not*
  a left/right score.
- **The frame** - whose interests the article centres, and who is affected
  but absent.
- **Voices** - alternative readings grounded only in facts the article itself
  states, each owned by a nameable constituency. Genuinely neutral articles
  get zero voices, on purpose.
- **In fairness** - the article's single strongest point, so the tool isn't
  just a fault-finder.
- **Claims** - the article's assertions, tagged fact vs. interpretation.

## Install (from source)

```sh
bash scripts/build.sh
```

- **Chrome**: `chrome://extensions` → enable Developer mode → *Load unpacked* → `dist/chrome`.
  Click the toolbar icon to open the side panel.
- **Firefox**: `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → `dist/firefox/manifest.json`.
  Counterpoint appears in the sidebar (toolbar icon opens it). On Firefox you may
  also need to grant the extension access to sites under its settings -
  Firefox treats MV3 host permissions as opt-in.

## Bring your own model

**Free by default.** Out of the box Counterpoint uses OpenRouter's free tier -
sign up at [openrouter.ai/keys](https://openrouter.ai/keys) (no credit card),
paste the key into Settings, done. Free models are rate-limited and slower,
and a small free model gives noticeably shallower analysis than a frontier
one - upgrade the model slug whenever you like.

| Provider | Key | Notes |
|---|---|---|
| OpenRouter (default) | free signup | defaults to a `:free` model; the model field suggests the current free list, or set any paid slug e.g. `anthropic/claude-opus-5` |
| Anthropic | required | defaults to `claude-opus-5` |
| OpenAI | required | defaults to `gpt-4o` |
| Google Gemini | free signup | defaults to `gemini-2.5-flash`; AI Studio keys ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) have a free tier |
| Ollama (local) | none | fully private, no account at all; see below |
| anything OpenAI-compatible | depends | pick OpenAI/OpenRouter and override the Base URL |

**Ollama**: run a model locally and nothing leaves your machine at all.
Ollama blocks browser-extension origins by default; start it with:

```sh
OLLAMA_ORIGINS='chrome-extension://*,moz-extension://*' ollama serve
```

### Where your key lives (honest version)

By default the key is held in extension session storage - memory only, gone
when the browser closes. If you tick *Remember key on this device* it is
stored **unencrypted** in extension local storage; anyone with access to your
computer profile could read it. There is no genuinely safe place for a secret
inside a browser extension, so we tell you rather than pretend. The key is
sent only to the provider you configured, directly from your browser.

## The prompt is yours

The **Prompt** tab shows the full system prompt driving the analysis. Edit it,
break it, improve it - the JSON output contract is enforced separately by
code, so a creative prompt can change the analysis but not break the display.
*Reset to default* undoes everything.

## Development

No build step for the code itself - plain ES modules. `scripts/build.sh`
just assembles `dist/chrome` and `dist/firefox` from the shared `src/` plus
the per-browser manifest.

```
src/
  background/main.js    orchestration: extract → prompt → provider → cache
  content/extract.js    Readability → JSON-LD → DOM → selection fallbacks
  providers/            one adapter per provider, normalised errors
  prompt/               default system prompt + output contract + parsing
  sidepanel/            the UI (vanilla JS)
vendor/Readability.js   Mozilla's article extractor (Apache-2.0)
```

Results are cached per (url, model, prompt) so tab-switching doesn't re-spend
your tokens; the ↻ button forces a fresh run.

## License

MIT. Free forever - this is meant as a public service.
Vendored `Readability.js` is Apache-2.0, © Arc90 / Mozilla.
