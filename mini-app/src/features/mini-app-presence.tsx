"use client";
import { useEffect } from "react";
import { useApi } from "@/shared/api/context";
import { endpoints } from "@/shared/api/client";

export function MiniAppPresence() {
  const api = useApi();
  useEffect(() => {
    const clientId = crypto.randomUUID();
    let sequence = 0;
    const update = (active: boolean) => {
      void api(endpoints.presence, {
        body: { client_id: clientId, sequence: ++sequence, active }, keepalive: true,
      }).catch(() => { /* A short server-side lease expires if the app loses connection. */ });
    };
    const visibility = () => update(!document.hidden);
    const leave = () => update(false);
    visibility();
    const timer = window.setInterval(() => { if (!document.hidden) update(true); }, 15000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", visibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", visibility);
      leave();
    };
  }, [api]);
  return null;
}
