import { api } from "../lib/env.js";
import { getKey, setKey } from "../lib/keys.js";
import { PROVIDERS, usesKey } from "../providers/index.js";
import { getSystemPrompt, setSystemPrompt } from "../prompt/build.js";
import { DEFAULT_SYSTEM_PROMPT } from "../prompt/defaults.js";
import { BUILD_INFO } from "../lib/version.js";

const $ = (id) => document.getElementById(id);

/* ---------- tabs ---------- */
for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab, .pane").forEach((el) => el.classList.remove("active"));
    tab.classList.add("active");
    $(`tab-${tab.dataset.tab}`).classList.add("active");
  });
}

/* ---------- settings ---------- */
// Radio group, not a <select>: native select popups can fail to open inside
// some browsers' side-panel containers.
const providerGroup = $("provider-group");
for (const [id, p] of Object.entries(PROVIDERS)) {
  const lab = document.createElement("label");
  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = "provider";
  radio.value = id;
  lab.append(radio, document.createTextNode(p.label));
  providerGroup.append(lab);
}
const getProvider = () => providerGroup.querySelector("input:checked")?.value ?? "openrouter";
const setProvider = (id) => {
  const radio = providerGroup.querySelector(`input[value="${CSS.escape(id)}"]`) ?? providerGroup.querySelector("input");
  radio.checked = true;
};

async function loadSettings() {
  const { cp_settings: s = {} } = await api.storage.local.get("cp_settings");
  setProvider(s.provider ?? "openrouter");
  $("model").value = s.model ?? "";
  $("baseurl").value = s.baseUrl ?? "";
  $("remember").checked = s.remember ?? false;
  await reflectProvider();
}

async function reflectProvider() {
  const provider = getProvider();
  const p = PROVIDERS[provider];
  $("model").placeholder = p.defaultModel || "e.g. anthropic/claude-opus-5";
  $("model-hint").textContent =
    provider === "openrouter"
      ? `Blank uses the free default: ${p.defaultModel}. A free key (no card) from openrouter.ai/keys is all you need.`
      : p.defaultModel
        ? `Blank uses the default: ${p.defaultModel}`
        : "Required for this provider.";
  populateFreeModels(provider);
  $("baseurl").placeholder = p.defaultBaseUrl || "https://my-server.example/v1";
  // A custom server has no default to fall back on, so say so.
  $("baseurl-hint").textContent = p.requiresBaseUrl
    ? "Required: the OpenAI-compatible endpoint to POST to, without /chat/completions."
    : "Leave blank for the provider default. Point at any OpenAI-compatible server.";
  const wantsKey = usesKey(p);
  $("key-row").hidden = !wantsKey;
  $("remember-row").hidden = !wantsKey;
  $("key-hint").textContent = p.optionalKey
    ? "Optional - leave blank for a server that needs no auth. Sent only to the Base URL above."
    : "Sent only to the provider above, from this browser. Never anywhere else.";
  $("apikey").value = "";
  if (wantsKey) {
    const existing = await getKey(provider);
    $("apikey").placeholder = existing ? "(key saved - leave blank to keep)" : "paste key";
  }
}
providerGroup.addEventListener("change", async () => {
  // Model slugs and base URLs don't transfer between providers.
  $("model").value = "";
  $("baseurl").value = "";
  await saveSettings();
  await reflectProvider();
});

// Offer OpenRouter's current no-cost models as suggestions so the hardcoded
// default can't rot into a dead slug. Best-effort; silence any failure.
let freeModelsLoaded = false;
async function populateFreeModels(provider) {
  const list = $("model-options");
  if (provider !== "openrouter") {
    list.replaceChildren();
    freeModelsLoaded = false;
    return;
  }
  if (freeModelsLoaded) return;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    const { data = [] } = await res.json();
    const free = data
      .filter((m) => m.id.endsWith(":free"))
      .map((m) => m.id)
      .sort();
    list.replaceChildren(...free.map((id) => new Option(id)));
    freeModelsLoaded = free.length > 0;
  } catch {
    /* offline or blocked - the text input still works */
  }
}

// Settings autosave - no Save button to forget.
//
// Every field is read SYNCHRONOUSLY before the first await, and saves are
// serialised behind one promise chain. Otherwise two overlapping saves (the
// apikey `change` that fires as focus leaves, plus the provider `change` from
// the same click) can read the key typed for provider A and store it under
// provider B - i.e. post your OpenAI key to OpenRouter.
let saveChain = Promise.resolve();
function saveSettings() {
  const provider = getProvider();
  const remember = $("remember").checked;
  const model = $("model").value.trim();
  const baseUrl = $("baseurl").value.trim();
  const typedKey = $("apikey").value.trim();
  $("apikey").value = ""; // consume it now so no later save can re-read it
  saveChain = saveChain.then(async () => {
    await api.storage.local.set({ cp_settings: { provider, model, baseUrl, remember } });
    if (typedKey) {
      await setKey(provider, typedKey, remember);
      await reflectProvider();
    } else if (usesKey(PROVIDERS[provider])) {
      // Re-store the existing key under the (possibly changed) remember mode.
      const existing = await getKey(provider);
      if (existing) await setKey(provider, existing, remember);
    }
    flash("settings-status", "Saved.");
  });
  return saveChain;
}
for (const id of ["model", "baseurl", "apikey", "remember"]) {
  $(id).addEventListener("change", saveSettings);
}

$("forget-key").addEventListener("click", async () => {
  const provider = getProvider();
  await setKey(provider, null, false);
  $("apikey").value = "";
  await reflectProvider();
  flash("settings-status", `Forgot the ${PROVIDERS[provider].label} key.`);
});

/* ---------- prompt ---------- */
async function loadPrompt() {
  $("prompt-text").value = await getSystemPrompt();
}
$("save-prompt").addEventListener("click", async () => {
  await setSystemPrompt($("prompt-text").value);
  flash("prompt-status", "Saved. New analyses use the updated prompt.");
});
$("reset-prompt").addEventListener("click", async () => {
  $("prompt-text").value = DEFAULT_SYSTEM_PROMPT;
  await setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
  flash("prompt-status", "Reset to default.");
});

function flash(id, text) {
  const el = $(id);
  el.textContent = text;
  el.hidden = false;
  el.classList.remove("error");
  setTimeout(() => (el.hidden = true), 2500);
}

/* ---------- analysis ---------- */
$("analyse").addEventListener("click", () => run(false));
$("reanalyse").addEventListener("click", () => run(true));

let running = false;
api.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "CP_PROGRESS" && running) {
    $("status").textContent = msg.text;
  }
});

const WATCHDOG_MS = 5 * 60 * 1000;

async function run(force) {
  if (running) return; // ↻ during a run would fire a second paid request
  const btn = $("analyse");
  const status = $("status");
  btn.disabled = true;
  $("reanalyse").disabled = true;
  running = true;
  $("empty-hint").hidden = true;
  $("results").hidden = true;
  status.hidden = false;
  status.classList.remove("error");
  status.textContent = "Starting…";

  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab.");
    const res = await Promise.race([
      api.runtime.sendMessage({ type: "CP_ANALYSE", tabId: tab.id, force }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timed out after 5 minutes. A free-tier model may be overloaded - try again, or set a faster model in Settings.")), WATCHDOG_MS)
      ),
    ]);
    if (!res) {
      throw new Error(
        "The background worker stopped before answering (it may have been shut down mid-request). Try again - a cached result is not saved in this case."
      );
    }
    if (!res.ok) {
      status.classList.add("error");
      status.textContent = res.error;
      if (res.kind === "auth") status.textContent += " (Settings tab → API key)";
      return;
    }
    status.hidden = true;
    render(res);
    $("reanalyse").hidden = false;
  } catch (e) {
    status.classList.add("error");
    status.textContent = e.message ?? String(e);
  } finally {
    btn.disabled = false;
    $("reanalyse").disabled = false;
    running = false;
  }
}

// Informational purposes read neutral; persuasion and promotion read as a
// caution. Kept out of render() so the mapping is easy to find and adjust.
const INTENT_CLASS = {
  inform: "good",
  explain: "good",
  persuade: "warn",
  provoke: "bad",
  promote: "bad",
};

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function render({ article, analysis, cached }) {
  const root = $("results");
  root.replaceChildren();
  root.hidden = false;

  const meta = el("p", "article-meta");
  meta.textContent = [
    article.siteName,
    article.byline,
    article.source === "selection" ? "your selection" : null,
    cached ? "cached result" : null,
    article.truncated ? "⚠ partial text only (paywall?)" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  root.append(meta);

  if (analysis.summary) {
    const card = el("div", "card");
    card.append(el("h2", null, "In one line"), el("p", null, analysis.summary));
    root.append(card);
  }

  /* bias axes */
  // A bare bar reads as "bad" whatever it says, so every bar carries its score,
  // a word for what that score means, and a colour keyed to severity.
  const AXIS_MEANING = {
    framing: "is interpretation presented as fact?",
    sourcing: "how many distinct interests are quoted?",
    emphasis: "what leads, and what is buried?",
    language: "loaded terms and emotive framing",
  };
  const SCORE_WORD = ["exemplary", "minor", "noticeable", "strong", "severe"];

  const bias = el("div", "card");
  bias.append(el("h2", null, "Lens check"));
  bias.append(el("p", "hint", "0 = exemplary, 4 = severe. Higher means the article leans harder on that axis."));
  let axesShown = 0;
  for (const [name, raw] of Object.entries(analysis.bias ?? {})) {
    // Models vary: {score, why} is the contract, but a bare number is common.
    const score = typeof raw === "number" ? raw : Number(raw?.score);
    const why = typeof raw === "object" && raw ? raw.why : null;
    if (!Number.isFinite(score)) continue; // skip junk rather than render 0/exemplary
    const clamped = Math.max(0, Math.min(4, score));
    const row = el("div", "axis");
    const label = el("span", "name", name);
    const meaning = AXIS_MEANING[String(name).toLowerCase()];
    if (meaning) label.title = meaning;
    row.append(label);
    const bar = el("div", "bar");
    const fill = el("span");
    fill.style.width = `${(clamped / 4) * 100}%`;
    bar.append(fill);
    row.append(bar);
    // Numeric score plus the word for it - the bar alone doesn't say which
    // direction is bad, and colour alone isn't accessible.
    row.append(el("span", "score", `${clamped}/4 ${SCORE_WORD[Math.round(clamped)]}`));
    row.dataset.severity = String(Math.round(clamped));
    if (why) row.append(el("p", "why", why));
    bias.append(row);
    axesShown++;
  }
  if (axesShown) root.append(bias);

  /* what the piece is built to do */
  const intent = analysis.intent;
  if (intent && (intent.reads_as || intent.why)) {
    const card = el("div", "card");
    card.append(el("h2", null, "What it's built to do"));
    if (intent.reads_as) {
      const line = el("p", "intent-line");
      line.append(el("span", `intent-tag ${INTENT_CLASS[String(intent.reads_as).toLowerCase()] ?? "other"}`, String(intent.reads_as)));
      if (intent.emotion) line.append(document.createTextNode(`aiming for: ${intent.emotion}`));
      card.append(line);
    }
    if (intent.why) card.append(el("p", null, intent.why));
    root.append(card);
  }

  /* frame */
  if (analysis.frame) {
    const card = el("div", "card");
    card.append(el("h2", null, "The frame"));
    if (analysis.frame.centred) card.append(el("p", null, `Centres: ${analysis.frame.centred}`));
    if (analysis.frame.missing) card.append(el("p", null, `Missing: ${analysis.frame.missing}`));
    if (analysis.frame.notes) card.append(el("p", "grounded", analysis.frame.notes));
    root.append(card);
  }

  /* voices */
  const voices = analysis.voices ?? [];
  const vCard = el("div", "card");
  vCard.append(el("h2", null, voices.length ? `${voices.length} voice${voices.length > 1 ? "s" : ""}` : "No other voices"));
  if (!voices.length) {
    vCard.append(el("p", null, analysis.no_voices_reason ?? "The model found no legitimate alternative reading."));
  }
  for (const v of voices) {
    vCard.append(el("h3", null, v.owner));
    vCard.append(el("p", null, v.reading));
    if (v.grounded_in) vCard.append(el("p", "grounded", `Grounded in: ${v.grounded_in}`));
  }
  root.append(vCard);

  /* strongest point */
  if (analysis.strongest_point) {
    const card = el("div", "card");
    card.append(el("h2", null, "In fairness"), el("p", null, analysis.strongest_point));
    root.append(card);
  }

  /* claims, collapsed */
  const claims = analysis.claims ?? [];
  if (claims.length) {
    const card = el("div", "card");
    const details = el("details");
    details.append(el("summary", null, `Claims (${claims.length})`));
    const ul = el("ul", "claims");
    for (const c of claims) {
      const li = el("li");
      const tag = el("span", `tag ${c.type === "fact" ? "fact" : "interpretation"}`, c.type === "fact" ? "fact" : "interp");
      li.append(tag, document.createTextNode(c.text));
      ul.append(li);
    }
    details.append(ul);
    card.append(details);
    root.append(card);
  }
}

/* ---------- init ---------- */
$("version").textContent = `v${api.runtime.getManifest().version} · ${BUILD_INFO}`;
loadSettings();
loadPrompt();
