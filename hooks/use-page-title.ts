"use client";

import { useEffect } from "react";

// Sets the browser tab title and keeps it: on a full page load Next.js
// re-applies the default title after hydration, so a one-off assignment is
// overwritten. Watching the <title> element puts ours back.
export function usePageTitle(title: string) {
  useEffect(() => {
    const full = `${title} | AIRA HRMS`;
    document.title = full;

    const node = document.querySelector("title");
    if (!node) return;

    const observer = new MutationObserver(() => {
      if (document.title !== full) document.title = full;
    });
    observer.observe(node, { childList: true, characterData: true, subtree: true });

    return () => observer.disconnect();
  }, [title]);
}
