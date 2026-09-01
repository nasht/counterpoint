# Counterpoint — Privacy Policy

_Last updated: 2 September 2026_

Counterpoint is a browser extension that analyses the news article you are
reading. This policy describes exactly what it does with your data.

## The short version

Counterpoint has no servers. There is no Counterpoint account, no analytics, no
telemetry, and no third party receives your data except the model provider you
choose and configure yourself.

## What the extension handles

**Article text.** When you click *Analyse*, the extension reads the article on
the active tab (or your text selection) and sends it to the model provider you
configured, directly from your browser. It is sent for that request only.

**Your API key.** The key you paste in Settings is used to authenticate that
request to your chosen provider. It is sent only to that provider's endpoint,
in the request's authorisation header, directly from your browser.

**Analysis results.** Results are cached locally so switching tabs does not
re-spend your tokens. The cache holds at most 40 entries, is keyed by a hash of
the URL, model and prompt, and never leaves your device.

**Settings.** Your provider, model, base URL and system prompt are stored
locally on your device.

## Where that data goes

Only to the provider you select, at the address shown in Settings:

- Anthropic, OpenAI, OpenRouter, Google Gemini or DeepSeek — the provider's own
  API endpoint, where their privacy policy and data-retention terms apply.
- Ollama or a custom OpenAI-compatible server — the address you enter. With a
  local Ollama server, nothing leaves your machine at all.

The extension sends data to no other destination. The developer receives
nothing and cannot see your keys, the pages you read, or your results.

## Where that data is stored

Everything is stored by your browser, on your device, using the extension
storage API:

- **API keys** are held in session storage by default, which is memory-only and
  cleared when the browser closes. If you tick *Remember key on this device*,
  the key moves to local storage so it survives a restart. In that case it is
  stored unencrypted, and anyone with access to your browser profile could read
  it. The extension tells you this at the checkbox.
- **Settings, cached results and your custom prompt** are held in local storage.

Removing the extension deletes all of it. *Forget this key* in Settings deletes
a stored key immediately.

## What the permissions are for

- **activeTab** and **scripting** — to read the article on the tab you are
  looking at, only when you ask for an analysis.
- **host permissions** — to read article text from the page you are on, and to
  call the API endpoint of the provider you configured, including a custom
  server address you supply.
- **storage** — to save your settings and cache results locally.
- **sidePanel** — to show the analysis panel.

## Data the extension does not collect

No browsing history, no personal identifiers, no usage analytics, no crash
reporting, no advertising identifiers. Nothing is sold or shared, because
nothing is collected.

## Contact

Counterpoint is free and open source. Read the code, or raise an issue, at
https://github.com/nasht/counterpoint
