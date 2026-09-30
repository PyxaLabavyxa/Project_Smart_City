"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/shared/ui/icon";
import styles from "./theme-toggle.module.css";

const eventName = "domoved-theme-change";
const preferenceKey = "domoved:theme:v1";

function subscribe(notify: () => void) {
  const syncStorage = (event: StorageEvent) => {
    if (event.key !== preferenceKey) return;
    document.documentElement.dataset.theme = event.newValue === "dark" ? "dark" : "light";
    notify();
  };
  window.addEventListener(eventName, notify);
  window.addEventListener("storage", syncStorage);
  return () => { window.removeEventListener(eventName, notify); window.removeEventListener("storage", syncStorage); };
}
const snapshot = () => document.documentElement.dataset.theme === "dark";
const serverSnapshot = () => false;

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  function toggleTheme() {
    const theme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#f2f8ff" : "#0c1626");
    try { localStorage.setItem(preferenceKey, theme); } catch {}
    window.dispatchEvent(new Event(eventName));
  }
  return <button className={styles.button} type="button" aria-pressed={dark} onClick={toggleTheme}>
    <Icon name={dark ? "sun" : "moon"} size={19} /><span>{dark ? "Светлая тема" : "Тёмная тема"}</span>
  </button>;
}
