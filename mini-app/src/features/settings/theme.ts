"use client";

import { useSyncExternalStore } from "react";

export type ThemePreference = "light" | "dark" | "system";
const key = "domoved:theme:v1";
const eventName = "domoved-theme-change";

export function readTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(key);
    if (value === "light" || value === "dark") return value;
  } catch {}
  return "system";
}

export function applyTheme() {
  const preference = readTheme();
  const dark = preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "only light";
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", dark ? "dark" : "only light");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#091f2c" : "#f1f9fc");
}

export function subscribeTheme(notify: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const sync = () => { applyTheme(); notify(); };
  const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) sync(); };
  window.addEventListener(eventName, sync);
  window.addEventListener("storage", storage);
  media.addEventListener("change", sync);
  return () => {
    window.removeEventListener(eventName, sync);
    window.removeEventListener("storage", storage);
    media.removeEventListener("change", sync);
  };
}

export function setTheme(preference: ThemePreference) {
  localStorage.setItem(key, preference);
  applyTheme();
  window.dispatchEvent(new Event(eventName));
}

export function useThemePreference() {
  return useSyncExternalStore(subscribeTheme, readTheme, () => "system" as const);
}
