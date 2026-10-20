"use client";

import { useEffect } from "react";

/** Keep the first client render identical to the server; enable motion after hydration. */
export function MotionPreferences() {
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => document.documentElement.classList.toggle("js-motion", !preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => {
      preference.removeEventListener("change", update);
      document.documentElement.classList.remove("js-motion");
    };
  }, []);
  return null;
}
