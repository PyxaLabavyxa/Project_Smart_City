"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useApi } from "@/shared/api/context";
import { OnboardingContext, type OnboardingStatus } from "./onboarding-context";

const Tour = dynamic(() => import("./onboarding").then(module => module.OnboardingTour));
type Result = Exclude<OnboardingStatus, "not_started">;

function cachedResult(userId: number): Result | null {
  try {
    const status = localStorage.getItem(`dompulse:onboarding:result:${userId}`);
    if (status === "completed" || status === "skipped") return status;
    // Earlier versions marked "done" even when the guide was skipped.
    if (localStorage.getItem(`dompulse:onboarding:registration:v2:${userId}`) === "done") return "skipped";
  } catch {}
  return null;
}

export function OnboardingProvider({ userId, status, children, deferAutomatic = false }: { userId: number; status: OnboardingStatus; children: ReactNode; deferAutomatic?: boolean }) {
  const api = useApi();
  const pathname = usePathname();
  const [request, setRequest] = useState(() => status === "not_started" && !cachedResult(userId) && !deferAutomatic && pathname === "/" ? 1 : 0);
  const [state, setState] = useState<{ activeTarget: string | null; preparing: boolean }>({ activeTarget: null, preparing: request > 0 });
  const [syncError, setSyncError] = useState("");
  const save = useCallback(async (result: Result) => {
    try { localStorage.setItem(`dompulse:onboarding:result:${userId}`, result); } catch {}
    try {
      await api("/me/onboarding", { body: { status: result }, keepalive: true });
      setSyncError("");
    } catch { setSyncError("Не удалось сохранить обучение. Повторить"); }
  }, [api, userId]);
  useEffect(() => {
    const cached = cachedResult(userId);
    if (cached && status !== "completed" && status !== cached) {
      void api("/me/onboarding", { body: { status: cached }, keepalive: true }).then(() => setSyncError(""), () => setSyncError("Не удалось сохранить обучение. Повторить"));
    }
  }, [userId, status, api]);
  const report = useCallback((activeTarget: string | null, preparing: boolean) => setState(previous => previous.activeTarget === activeTarget && previous.preparing === preparing ? previous : { activeTarget, preparing }), []);
  return <OnboardingContext value={{ ...state, start: () => { setState({ activeTarget: null, preparing: true }); setRequest(value => value + 1); } }}>
    {syncError && <button className="onboarding-sync-error" type="button" onClick={() => void save(cachedResult(userId) ?? "skipped")}>{syncError}</button>}
    {children}
    {request > 0 && <Tour key={request} onStateChange={report} onFinish={save} />}
  </OnboardingContext>;
}
