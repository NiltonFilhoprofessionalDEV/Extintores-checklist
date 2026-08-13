"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Detecta scroll para colapsar a bottom navigation (ícones apenas ao rolar para baixo).
 */
export function useMobileNavCollapse(scrollElement: HTMLElement | null): boolean {
  const [collapsed, setCollapsed] = useState(false);
  const lastScrollTopRef = useRef(0);
  const scrollStopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!scrollElement) return;

    const onScroll = () => {
      const current = scrollElement.scrollTop;
      const delta = current - lastScrollTopRef.current;

      if (delta > 6 && current > 24) {
        setCollapsed(true);
      } else if (delta < -4) {
        setCollapsed(false);
      }

      lastScrollTopRef.current = current;

      if (scrollStopTimerRef.current !== null) {
        window.clearTimeout(scrollStopTimerRef.current);
      }
      scrollStopTimerRef.current = window.setTimeout(() => {
        setCollapsed(false);
      }, 900);
    };

    scrollElement.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollElement.removeEventListener("scroll", onScroll);
      if (scrollStopTimerRef.current !== null) {
        window.clearTimeout(scrollStopTimerRef.current);
      }
    };
  }, [scrollElement]);

  return collapsed;
}
