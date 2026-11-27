// src/components/builder/effects.js
//
// Release 1.3: entrance animations. Elements with an entrance animation get the
// "bx-anim" class; this observer adds "is-in" as they scroll into view. The
// page is marked "bx-anim-ready" only once the observer runs, so content is
// never hidden if scripts fail. Reduced-motion users see no animation (CSS).

import { useEffect } from "react";

export function useEntranceAnimations() {
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window))
      return undefined;
    const root = document.documentElement;
    root.classList.add("bx-anim-ready");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    const scan = () =>
      document
        .querySelectorAll(".bx-anim:not(.is-in)")
        .forEach((el) => io.observe(el));
    scan();
    // Pages render content after loading data, and the editor re-renders it.
    const mo = new MutationObserver(() => scan());
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      root.classList.remove("bx-anim-ready");
    };
  }, []);
}
