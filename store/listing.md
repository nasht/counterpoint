# Chrome Web Store listing — draft copy

Fill this into the Developer Dashboard. Nothing here is submitted
automatically; it is the text to paste.

## Name
Counterpoint

## Short description (132 char limit — this is 122)
Every story has another line. Analyse news articles for framing and bias, and hear the other voices - with your own model.

## Category
News & Weather  (alternative: Productivity)

## Detailed description

Every story has another line.

Counterpoint reads the news article you are on and shows you the same facts
through the other legitimate lenses - the letters page the article never
printed. It is not a debunking tool and not a left/right rating.

You get:

- Lens check - four independent 0-4 ratings (framing, sourcing, emphasis,
  language), each justified with a quote from the article, each labelled with
  what the score means.
- What it's built to do - whether the piece reads as written to inform,
  explain, persuade, provoke or promote, and which emotion the tone works to
  produce.
- The frame - whose interests the article centres, and who is affected but
  absent.
- Voices - how specific, nameable constituencies would read the same facts,
  grounded only in what the article itself states. A genuinely neutral article
  gets zero voices, on purpose.
- In fairness - the article's single strongest point, so the tool is not just a
  fault-finder.
- Claims - the article's assertions, separated into fact and interpretation.

Bring your own model. Counterpoint has no servers and no account. Your API key
and the article text go directly from your browser to the provider you choose:
Anthropic, OpenAI, OpenRouter, Google Gemini, DeepSeek, any OpenAI-compatible
server, or a local Ollama install where nothing leaves your machine at all.

The system prompt is fully editable, so the analysis is yours to shape.

Free and open source: https://github.com/nasht/counterpoint

## Privacy practices — answers for the dashboard form

Single purpose:
  Analyse the news article on the current tab for framing and bias, and present
  alternative readings of the same facts.

Justification — activeTab:
  Reads the article text of the tab the user is viewing, only when the user
  clicks Analyse.

Justification — scripting:
  Injects the article-extraction content script into the active tab on demand,
  to pull the readable article text out of the page.

Justification — storage:
  Stores the user's provider settings, editable system prompt, and a small
  local cache of results so switching tabs does not re-spend their API credits.

Justification — sidePanel:
  The analysis is displayed in the side panel.

Justification — host permissions:
  Two uses. (1) Reading article text from whichever news site the user is on,
  which cannot be known in advance. (2) Calling the API endpoint of the model
  provider the user configures, which includes an arbitrary base URL the user
  may enter for a self-hosted or custom OpenAI-compatible server.

Remote code: No. All code is in the package. The extension fetches data (model
lists and analysis responses) but never executes remotely-fetched code.

Data collected: none by the developer. Disclose in the form that the extension
transmits "website content" (the article text) and "authentication information"
(the user's own API key) to a user-selected third-party endpoint, and that this
is required for the extension's single purpose and is not sold or transferred
for any other reason.

Privacy policy URL: (host PRIVACY.md, e.g. the GitHub raw/blob URL)
