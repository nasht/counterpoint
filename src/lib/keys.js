import { api } from "./env.js";

// API keys live in storage.session (memory-only, cleared when the browser
// closes) unless the user explicitly opts into "remember on this device",
// which promotes the key to storage.local. Keys never touch content scripts.

const k = (provider) => `cp_key_${provider}`;

export async function getKey(provider) {
  const name = k(provider);
  const sess = await api.storage.session.get(name);
  if (sess[name]) return sess[name];
  const local = await api.storage.local.get(name);
  return local[name] ?? null;
}

export async function setKey(provider, key, remember) {
  const name = k(provider);
  if (!key) {
    await api.storage.session.remove(name);
    await api.storage.local.remove(name);
    return;
  }
  if (remember) {
    await api.storage.local.set({ [name]: key });
    await api.storage.session.remove(name);
  } else {
    await api.storage.session.set({ [name]: key });
    await api.storage.local.remove(name);
  }
}

