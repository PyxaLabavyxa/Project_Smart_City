"use client";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { createUtilitiesGateway } from "@/entities/utilities/api-gateway";
import { UtilitiesProvider } from "@/entities/utilities";
import { HouseSelectionProvider, type House } from "@/entities/house";
import { parseApartment, parseProfile, type ResidentProfile } from "@/entities/house/model/api";
import { IssueProvider } from "@/entities/issue";
import { createIssueGateway } from "@/entities/issue/model/api-gateway";
import { MessageProvider } from "@/entities/message";
import { createMessageGateway } from "@/entities/message/model/api-gateway";
import { ApiContext, useApi } from "@/shared/api/context";
import { createApiClient, endpoints, maxLaunchData } from "@/shared/api/client";
import { readPages } from "@/shared/api/pagination";
import { useRemote } from "@/shared/api/use-remote";
import { MiniAppPresence } from "@/features/mini-app-presence";
import { LaunchNavigation } from "@/features/launch-navigation";
import { OnboardingProvider } from "@/features/onboarding/onboarding";
import { RequestState } from "@/shared/ui/navigation/request-state";

export function AppProviders({ children }: { children: ReactNode }) {
  const localEnabled = process.env.NEXT_PUBLIC_ENABLE_LOCAL_LOGIN === "true";
  const [mode, setMode] = useState<"local" | "max">(localEnabled ? "local" : "max");
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  async function switchMode(next: "local" | "max") {
    if (switching || next === mode) return;
    setSwitching(true);
    setSwitchError("");
    try {
      await createApiClient()(endpoints.logout, { body: {} });
      setMode(next);
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "Не удалось сменить режим");
    } finally { setSwitching(false); }
  }
  return <>
    {localEnabled && <aside className="local-login-bar" aria-label="Режим входа">
      <span>{mode === "local" ? "Локальный вход" : "Вход через MAX"}</span>
      <label>Режим <select value={mode} disabled={switching} onChange={event => void switchMode(event.target.value === "local" ? "local" : "max")}>
        <option value="local">Локальный</option><option value="max">MAX</option>
      </select></label>
      {switchError && <p role="alert">{switchError}</p>}
    </aside>}
    <AuthenticatedApp key={mode} mode={mode}>{children}</AuthenticatedApp>
  </>;
}

function AuthenticatedApp({ children, mode }: { children: ReactNode; mode: "local" | "max" }) {
  const load = useCallback(async (signal: AbortSignal) => {
    const initData = maxLaunchData();
    const api = createApiClient();
    if (mode === "local") await api(endpoints.localLogin, { body: {}, signal });
    else if (initData) await api(endpoints.login, { body: { init_data: initData }, signal });
    const profile = parseProfile(await api(endpoints.me, { signal }));
    return { api, profile };
  }, [mode]);
  const state = useRemote(load);
  if (!state.data) return <main className="connection-screen"><h1>ДомПульс</h1><RequestState {...state} /></main>;
  return <ApiContext value={state.data.api}>{mode === "max" && <LaunchNavigation />}<MiniAppPresence /><ResidentHomes profile={state.data.profile}>{children}</ResidentHomes></ApiContext>;
}

function ResidentHomes({ profile, children }: { profile: ResidentProfile; children: ReactNode }) {
  const [selected, choose] = useState(profile.apartments[0]?.id);
  const resident = profile.apartments.find(a => a.id === selected);
  const house = profile.houses.find(h => h.id === resident?.houseId);
  const choices = profile.apartments.map(a => ({ id: a.id, houseId: a.houseId, apartment: a.number, address: profile.houses.find(h => h.id === a.houseId)?.address ?? "Дом" }));
  if (!resident || !house) return <main className="connection-screen"><h1>Дом пока не привязан</h1><p>Добавьте квартиру через чатбот, затем откройте приложение заново.</p></main>;
  return <ConnectedHouse key={resident.id} userId={profile.id} house={{ ...house, residentApartment: resident.number, residentApartmentId: resident.id }} choices={choices} choose={choose}>{children}</ConnectedHouse>;
}

function ConnectedHouse({ userId, house, choices, choose, children }: { userId: number; house: House; choices: { id: number; houseId: string; apartment: number; address: string }[]; choose: (id: number) => void; children: ReactNode }) {
  const api = useApi();
  const load = useCallback((signal: AbortSignal) => readPages(api, endpoints.apartments(house.id), parseApartment, signal), [api, house.id]);
  const state = useRemote(load);
  const currentHouse = useMemo(() => ({ ...house, apartments: state.data ?? [] }), [house, state.data]);
  const issueGateway = useMemo(() => createIssueGateway(api, currentHouse), [api, currentHouse]);
  const messageGateway = useMemo(() => createMessageGateway(api, currentHouse), [api, currentHouse]);
  const utilitiesGateway = useMemo(() => createUtilitiesGateway(api, house.residentApartmentId!), [api, house.residentApartmentId]);
  if (!state.data) return <main className="connection-screen"><h1>{house.address}</h1><RequestState {...state} /></main>;
  return <HouseSelectionProvider house={currentHouse} choices={choices} choose={choose}>
    <IssueProvider gateway={issueGateway}><MessageProvider gateway={messageGateway}>
      <UtilitiesProvider gateway={utilitiesGateway}><OnboardingProvider userId={userId}>{children}</OnboardingProvider></UtilitiesProvider>
    </MessageProvider></IssueProvider>
  </HouseSelectionProvider>;
}
