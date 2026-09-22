"use client";

import { useState } from "react";
import styles from "./theme-toggle.module.css";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  function toggleTheme() {
    const nextDark = !dark;
    document.documentElement.dataset.theme = nextDark ? "dark" : "light";
    setDark(nextDark);
  }

  return (
    <button className={styles.button} type="button" aria-pressed={dark} onClick={toggleTheme}>
      Тёмная тема
    </button>
  );
}
