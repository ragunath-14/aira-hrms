"use client";

import { useEffect } from "react";

// Marks <body> once React has taken over the page. Until then buttons are
// shown inactive (see globals.css) instead of silently swallowing a click that
// arrives before the page is interactive.
export function HydrationFlag() {
  useEffect(() => {
    document.body.dataset.hydrated = "true";
  }, []);

  return null;
}
