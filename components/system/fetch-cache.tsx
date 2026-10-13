"use client";

// Makes repeat API reads instant. Identical GET /api requests are shared while
// in flight (the sidebar and navbar both ask for /api/tenant) and answered from
// memory for a few seconds afterwards, so moving between pages doesn't wait on
// the database again. Any write (POST/PUT/PATCH/DELETE) drops the whole cache
// so screens never show data older than the user's own change.

const TTL_MS = 15_000;

type Entry = { expires: number; response: Promise<Response> };

declare global {
  interface Window {
    __fetchCacheInstalled?: boolean;
  }
}

function install() {
  if (typeof window === "undefined" || window.__fetchCacheInstalled) {
    return;
  }

  window.__fetchCacheInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  const cache = new Map<string, Entry>();

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (
      init?.method ??
      (input instanceof Request ? input.method : "GET")
    ).toUpperCase();

    const url = new URL(
      input instanceof Request ? input.url : String(input),
      window.location.origin,
    );

    const isApi =
      url.origin === window.location.origin &&
      url.pathname.startsWith("/api/");

    if (!isApi) {
      return nativeFetch(input, init);
    }

    if (method !== "GET") {
      cache.clear();
      return nativeFetch(input, init);
    }

    // Auth/session state must always be fresh.
    if (url.pathname.startsWith("/api/auth/") || init?.signal) {
      return nativeFetch(input, init);
    }

    const key = url.pathname + url.search;
    const hit = cache.get(key);

    if (hit && hit.expires > Date.now()) {
      return hit.response.then((r) => r.clone());
    }

    const response = nativeFetch(input, init).then((r) => {
      // Only keep successful reads.
      if (!r.ok) {
        cache.delete(key);
      }
      return r;
    });

    response.catch(() => cache.delete(key));
    cache.set(key, { expires: Date.now() + TTL_MS, response });

    return response.then((r) => r.clone());
  };
}

install();

export function FetchCache() {
  return null;
}
