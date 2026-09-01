// Cross-browser API handle. Firefox exposes promise-based `browser`;
// Chrome MV3's `chrome` is also promise-based for everything we use.
export const api = globalThis.browser ?? globalThis.chrome;
export const IS_FIREFOX = typeof globalThis.browser !== "undefined";
