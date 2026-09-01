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

// Reads don't write. Touching the LRU timestamp on every read meant a
// read-modify-write cycle that could clobber a concurrent cacheSet from
// another window; insertion recency is good enough for a result cache.
export async function cacheGet(key) {
  const { [CACHE_KEY]: cache = {} } = await api.storage.local.get(CACHE_KEY);
  return cache[key]?.value ?? null;
}

// Serialise writes within this context so two analyses can't each read the
// cache, mutate their own snapshot, and write back over one another.
let writeChain = Promise.resolve();
export function cacheSet(key, value) {
  writeChain = writeChain.then(async () => {
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
  });
  return writeChain;
}

