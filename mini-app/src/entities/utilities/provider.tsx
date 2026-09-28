"use client";
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { UtilitiesGateway, UtilityAccount } from "./model";
type UtilitiesState = { account?: UtilityAccount; loading: boolean; error: string; reload: () => void; saveReading: (id: string, value: string) => Promise<void> };
const Context = createContext<UtilitiesState | null>(null);
export function UtilitiesProvider({ children, gateway }: { children: ReactNode; gateway: UtilitiesGateway }) {
  const [account, setAccount] = useState<UtilityAccount>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  function reload() { setLoading(true); setError(""); setAttempt(current => current + 1); }
  useEffect(() => {
    let cancelled = false;
    gateway.loadAccount().then(value => { if (!cancelled) setAccount(value); }).catch((error: unknown) => { if (!cancelled) setError(error instanceof Error ? error.message : "Не удалось загрузить лицевой счёт. Повторите попытку."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [gateway, attempt]);
  async function saveReading(id: string, value: string) {
    const updated = await gateway.saveReading(id, value);
    setAccount(updated);
  }
  return <Context value={{ account, loading, error, reload, saveReading }}>{children}</Context>;
}
export function useUtilityAccount() {
  const context = useContext(Context);
  if (!context) throw new Error("UtilitiesProvider is required");
  return context;
}
