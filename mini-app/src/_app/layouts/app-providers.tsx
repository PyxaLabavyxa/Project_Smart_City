"use client";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createUtilitiesGateway } from "@/entities/utilities/api-gateway";
import { UtilitiesProvider } from "@/entities/utilities";
import { HouseSelectionProvider, type House } from "@/entities/house";
import { parseApartment, parseProfile, type ResidentProfile } from "@/entities/house/model/api";
import { IssueProvider } from "@/entities/issue";
import { createIssueGateway } from "@/entities/issue/model/api-gateway";
import { MessageProvider } from "@/entities/message";
import { createMessageGateway } from "@/entities/message/model/api-gateway";
import { ApiContext, useApi } from "@/shared/api/context";
import { createApiClient, endpoints, maxLaunchData, maxLaunchTarget } from "@/shared/api/client";
import { launchApartmentId } from "@/entities/house/model/launch-selection";
import { readPages } from "@/shared/api/pagination";
import { useRemote } from "@/shared/api/use-remote";
import { RefreshButton } from "@/shared/ui/refresh-button";
import { RegistrationScreen } from "@/features/registration/registration";
import { ChatHouseAccess } from "@/features/registration/chat-house-access";
import { MiniAppPresence } from "@/features/mini-app-presence";
import { LaunchNavigation } from "@/features/launch-navigation";
import { OnboardingProvider } from "@/features/onboarding/onboarding";
import { ThemeSync } from "@/features/settings/theme-sync";
import { StartupScreen } from "@/shared/ui/startup-screen";
import { ConfirmationProvider } from "@/shared/ui/confirmation";
import { InteractionMode } from "@/shared/ui/interaction-mode";

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
    <ThemeSync />
    <InteractionMode />
    {localEnabled && process.env.NEXT_PUBLIC_SHOW_LOCAL_LOGIN_CONTROLS === "true" && <aside className="local-login-bar" aria-label="Режим входа">
      <span>{mode === "local" ? "Локальный вход" : "Вход через MAX"}</span>
      <label>Режим <select value={mode} disabled={switching} onChange={event => void switchMode(event.target.value === "local" ? "local" : "max")}>
        <option value="local">Локальный</option><option value="max">MAX</option>
      </select></label>
      {switchError && <p role="alert">{switchError}</p>}
    </aside>}
    <ConfirmationProvider key={mode}><AuthenticatedApp mode={mode}>{children}</AuthenticatedApp></ConfirmationProvider>
  </>;
}

function AuthenticatedApp({ children, mode }: { children: ReactNode; mode: "local" | "max" }) {
  const load = useCallback(async (signal: AbortSignal) => {
    const initData = maxLaunchData();
    const api = createApiClient();
    if (mode === "local") await api(endpoints.localLogin, { body: {}, signal });
    else if (initData) await api(endpoints.login, { body: { init_data: initData }, signal });
    return { api, launch: mode === "max" ? maxLaunchTarget() : undefined };
  }, [mode]);
  const state = useRemote(load);
  if (!state.data) return <StartupScreen error={state.error} actions={state.error ? <RefreshButton onRefresh={state.reload} loading={state.loading}>Повторить</RefreshButton> : undefined} />;
  return <ApiContext value={state.data.api}><LaunchNavigation target={state.data.launch?.href} /><MiniAppPresence /><ResidentProfileView launchHouseId={state.data.launch?.houseId}>{children}</ResidentProfileView></ApiContext>;
}

function ResidentProfileView({ children, launchHouseId }: { children: ReactNode; launchHouseId?: string }) {
  const api = useApi();
  const router = useRouter();
  const [chatEntryDismissed, setChatEntryDismissed] = useState(false);
  const load = useCallback(async (signal: AbortSignal) => parseProfile(await api(endpoints.me, { signal })), [api]);
  const state = useRemote(load);
  if (!state.data) return <StartupScreen error={state.error} actions={state.error ? <RefreshButton onRefresh={state.reload} loading={state.loading}>Повторить</RefreshButton> : undefined} />;
  const targetHouse = chatEntryDismissed ? undefined : launchHouseId;
  if (targetHouse && launchApartmentId(state.data.apartments, targetHouse) === undefined) return <ChatHouseAccess
    hasApartments={state.data.apartments.length > 0}
    onComplete={state.reload}
    onHome={() => { setChatEntryDismissed(true); router.replace("/"); }}
  />;
  return <>{state.error && <div role="alert"><p>{state.error}</p><RefreshButton onRefresh={state.reload} loading={state.loading}>Обновить квартиры</RefreshButton></div>}{state.data.apartments.length ? <ResidentHomes profile={state.data} refreshHomes={state.reload} launchHouseId={targetHouse}>{children}</ResidentHomes> : <RegistrationScreen onComplete={state.reload} />}</>;
}

function ResidentHomes({ profile, children, refreshHomes, launchHouseId }: { profile: ResidentProfile; children: ReactNode; refreshHomes: () => void; launchHouseId?: string }) {
  const [selected, choose] = useState<number>();
  const apartmentId = selected ?? launchApartmentId(profile.apartments, launchHouseId);
  const resident = profile.apartments.find(a => a.id === apartmentId);
  const house = profile.houses.find(h => h.id === resident?.houseId);
  const choices = profile.apartments.map(a => ({ id: a.id, houseId: a.houseId, apartment: a.number, address: profile.houses.find(h => h.id === a.houseId)?.address ?? "Дом" }));
  if (!resident || !house) return <main className="connection-screen"><h1>Дом пока не привязан</h1><p>Добавьте квартиру через чатбот, затем откройте приложение заново.</p></main>;
  return <ConnectedHouse key={resident.id} userId={profile.id} house={{ ...house, residentApartment: resident.number, residentApartmentId: resident.id }} choices={choices} choose={choose} refreshHomes={refreshHomes}>{children}</ConnectedHouse>;
}

function ConnectedHouse({ userId, house, choices, choose, children, refreshHomes }: { userId: number; house: House; choices: { id: number; houseId: string; apartment: number; address: string }[]; choose: (id: number) => void; children: ReactNode; refreshHomes: () => void }) {
  const api = useApi();
  const load = useCallback((signal: AbortSignal) => readPages(api, endpoints.apartments(house.id), parseApartment, signal), [api, house.id]);
  const state = useRemote(load);
  const currentHouse = useMemo(() => ({ ...house, apartments: state.data ?? [] }), [house, state.data]);
  const issueGateway = useMemo(() => createIssueGateway(api, currentHouse), [api, currentHouse]);
  const messageGateway = useMemo(() => createMessageGateway(api, currentHouse), [api, currentHouse]);
  const utilitiesGateway = useMemo(() => createUtilitiesGateway(api, house.residentApartmentId!), [api, house.residentApartmentId]);
  if (!state.data) return <StartupScreen error={state.error} actions={state.error ? <RefreshButton onRefresh={state.reload} loading={state.loading}>Повторить</RefreshButton> : undefined} />;
  return <HouseSelectionProvider house={currentHouse} choices={choices} choose={choose} refreshHomes={refreshHomes}>
    <IssueProvider gateway={issueGateway}><MessageProvider gateway={messageGateway}>
      <UtilitiesProvider gateway={utilitiesGateway}><OnboardingProvider userId={userId}>{children}</OnboardingProvider></UtilitiesProvider>
    </MessageProvider></IssueProvider>
  </HouseSelectionProvider>;
}
