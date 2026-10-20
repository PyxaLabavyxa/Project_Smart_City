"use client";
import { useEffect } from "react";

/** Keep keyboard navigation immediate while allowing subtle pointer feedback. */
export function InteractionMode() {
  useEffect(() => {
    const pointer = () => { document.documentElement.dataset.motionInput = "pointer"; };
    const keyboard = (event: KeyboardEvent) => { if (!event.metaKey && !event.ctrlKey && !event.altKey) document.documentElement.dataset.motionInput = "keyboard"; };
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", keyboard, true);
    return () => { document.removeEventListener("pointerdown", pointer, true); document.removeEventListener("keydown", keyboard, true); };
  }, []);
  return null;
}
