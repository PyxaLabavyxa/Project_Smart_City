"use client";
import { createContext, useContext } from "react";
import type { ApiClient } from "./client";
export const ApiContext = createContext<ApiClient | null>(null);
export function useApi() {
  const api = useContext(ApiContext);
  if (!api) throw new Error("API connection is required");
  return api;
}
