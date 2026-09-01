# Counterpoint

*Every story has another line.*

A free, open-source browser extension (Chrome + Firefox) that analyses the news
article you're reading for framing and bias, then offers **voices** - readings
of the same facts that other constituencies hold. Closer to the letters page the
article never printed than to a fact-check.

Bring your own model: your API key, your provider, your prompt. Nothing passes
through anyone's server but your model provider's.

## What it does

- **Lens check** - four independent 0-4 ratings (framing, sourcing, emphasis,
  language), each justified with a quote from the article, each labelled with
  its score and what that score means (0 = exemplary, 4 = severe). Deliberately
  *not* a left/right score.
- **What it's built to do** - whether the piece reads as written to inform,
  explain, persuade, provoke, or promote, and which emotion (if any) the tone
  is working to produce.
- **The frame** - whose interests the article centres, and who is affected
  but absent.
- **Voices** - alternative readings grounded only in facts the article itself
  states, each owned by a nameable constituency and written as attribution
  ("renters may well welcome..."), never as the tool's own opinion. Genuinely
  neutral articles get zero voices, on purpose.
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
| DeepSeek | required | defaults to `deepseek-chat`; keys from [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| Ollama (local) | none | fully private, no account; see below |
| Custom (OpenAI-compatible) | optional | paste the Base URL of any OpenAI-compatible server (vLLM, LM Studio, LiteLLM, a proxy). Leave the key blank if it needs no auth |

**Ollama**: run a model locally and nothing leaves your machine.
Ollama blocks browser-extension origins by default, so start it with:

```sh
OLLAMA_ORIGINS='chrome-extension://*,moz-extension://*' ollama serve
```

### Where your key lives

By default the key is held in extension session storage - memory only, gone
when the browser closes. If you tick *Remember key on this device* it is
stored **unencrypted** in extension local storage; anyone with access to your
computer profile could read it. There is no safe place for a secret inside a
browser extension. The key is sent only to the provider you configured, directly
from your browser.

## The prompt is yours

The **Prompt** tab shows the full system prompt driving the analysis. Edit it.
The JSON output contract is enforced separately by code, so a creative prompt
changes the analysis but can't break the display. *Reset to default* undoes
everything.

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

MIT, and meant as a public service.
Vendored `Readability.js` is Apache-2.0, © Arc90 / Mozilla.
