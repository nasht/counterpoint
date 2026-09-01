import { api } from "./env.js";

// Analysis results cached by hash(url + model + prompt) so switching tabs
// doesn't re-spend the user's tokens. Simple LRU, capped.

const CACHE_KEY = "cp_cache";
const MAX_ENTRIES = 40;

async function digest(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function cacheKey(url, model, promptText) {
  return digest(`${url}\n${model}\n${promptText}`);
}

export async function cacheGet(key) {
  const { [CACHE_KEY]: cache = {} } = await api.storage.local.get(CACHE_KEY);
  const hit = cache[key];
  if (!hit) return null;
  hit.at = Date.now(); // touch for LRU
  await api.storage.local.set({ [CACHE_KEY]: cache });
  return hit.value;
}

export async function cacheSet(key, value) {
  const { [CACHE_KEY]: cache = {} } = await api.storage.local.get(CACHE_KEY);
  cache[key] = { value, at: Date.now() };
  const keys = Object.keys(cache);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => cache[a].at - cache[b].at)
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((old) => delete cache[old]);
  }
  await api.storage.local.set({ [CACHE_KEY]: cache });
}

export async function cacheClear() {
  await api.storage.local.remove(CACHE_KEY);
}
