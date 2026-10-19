"use client";
import { useEffect } from "react";
import { applyTheme, subscribeTheme } from "./theme";

export function ThemeSync() {
  useEffect(() => {
    applyTheme();
    return subscribeTheme(() => {});
  }, []);
  return null;
}
