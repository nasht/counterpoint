import { api } from "../lib/env.js";
import { getKey, setKey } from "../lib/keys.js";
import { PROVIDERS } from "../providers/index.js";
import { getSystemPrompt, setSystemPrompt } from "../prompt/build.js";
import { DEFAULT_SYSTEM_PROMPT } from "../prompt/defaults.js";

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
const providerSel = $("provider");
for (const [id, p] of Object.entries(PROVIDERS)) {
  providerSel.append(new Option(p.label, id));
}

async function loadSettings() {
  const { cp_settings: s = {} } = await api.storage.local.get("cp_settings");
  providerSel.value = s.provider ?? "openrouter";
  $("model").value = s.model ?? "";
  $("baseurl").value = s.baseUrl ?? "";
  $("remember").checked = s.remember ?? false;
  await reflectProvider();
}

async function reflectProvider() {
  const p = PROVIDERS[providerSel.value];
  $("model").placeholder = p.defaultModel || "e.g. anthropic/claude-opus-5";
  $("model-hint").textContent =
    providerSel.value === "openrouter"
      ? `Blank uses the free default: ${p.defaultModel}. A free key (no card) from openrouter.ai/keys is all you need.`
      : p.defaultModel
        ? `Blank uses the default: ${p.defaultModel}`
        : "Required for this provider.";
  populateFreeModels(providerSel.value);
  $("baseurl").placeholder = p.defaultBaseUrl;
  $("key-row").hidden = !p.needsKey;
  $("remember-row").hidden = !p.needsKey;
  $("apikey").value = "";
  if (p.needsKey) {
    const existing = await getKey(providerSel.value);
    $("apikey").placeholder = existing ? "(key saved - leave blank to keep)" : "paste key";
  }
}
providerSel.addEventListener("change", async () => {
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
async function saveSettings() {
  const provider = providerSel.value;
  const remember = $("remember").checked;
  await api.storage.local.set({
    cp_settings: {
      provider,
      model: $("model").value.trim(),
      baseUrl: $("baseurl").value.trim(),
      remember,
    },
  });
  const typedKey = $("apikey").value.trim();
  if (typedKey) {
    await setKey(provider, typedKey, remember);
    $("apikey").value = "";
    await reflectProvider();
  } else if (PROVIDERS[provider].needsKey) {
    // Re-store the existing key under the (possibly changed) remember mode.
    const existing = await getKey(provider);
    if (existing) await setKey(provider, existing, remember);
  }
  flash("settings-status", "Saved.");
}
for (const id of ["model", "baseurl", "apikey", "remember"]) {
  $(id).addEventListener("change", saveSettings);
}

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
  const btn = $("analyse");
  const status = $("status");
  btn.disabled = true;
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
    if (!res) throw new Error("No response from background script.");
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
    running = false;
  }
}

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
  const bias = el("div", "card");
  bias.append(el("h2", null, "Lens check"));
  for (const [name, axis] of Object.entries(analysis.bias ?? {})) {
    const row = el("div", "axis");
    row.append(el("span", "name", name));
    const bar = el("div", "bar");
    const fill = el("span");
    fill.style.width = `${(Math.max(0, Math.min(4, axis.score ?? 0)) / 4) * 100}%`;
    bar.append(fill);
    row.append(bar);
    if (axis.why) row.append(el("p", "why", axis.why));
    bias.append(row);
  }
  root.append(bias);

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
loadSettings();
loadPrompt();
