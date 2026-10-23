import { launchTarget } from "./launch-route.ts";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export function apiUrl(path: string) {
  return `${(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "")}${path}`;
}

export type ApiClient = ReturnType<typeof createApiClient>;
export function createApiClient({ maxInitData = "" }: { maxInitData?: string } = {}) {
  const cache = new Map<string, { data: unknown; expires: number }>();
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
  // Safari may reject third-party cookies when MAX Web runs as a home-screen app.
  // Keep the normal cookie flow, then use the API's existing signed-launch-data
  // authentication only if that session is unavailable. Never persist the data.
  let useLaunchData = false;
  return async (path: string, options: { body?: unknown; method?: "DELETE"; signal?: AbortSignal; keepalive?: boolean; cacheFor?: number; responseType?: "blob" } = {}): Promise<unknown> => {
    const cacheKey = `${options.responseType ?? "json"}:${path}`;
    const cached = cache.get(cacheKey);
    options.signal?.throwIfAborted();
    if (!options.method && options.body === undefined && options.cacheFor && cached && cached.expires > Date.now()) return cached.data;
    const multipart = options.body instanceof FormData;
    const timeout = AbortSignal.timeout(multipart ? 120000 : /\/cameras(?:\/|$)/.test(path) ? 30000 : 15000);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    try {
      const request: RequestInit = {
        method: options.method ?? (options.body === undefined ? "GET" : "POST"),
        credentials: "include",
        body: multipart ? options.body as FormData : options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: "no-store", signal, keepalive: options.keepalive,
      };
      const headers = new Headers(options.body === undefined || multipart ? {} : { "Content-Type": "application/json" });
      const canUseLaunchData = !!maxInitData && path !== endpoints.login && path !== endpoints.localLogin && path !== endpoints.logout;
      if (useLaunchData && canUseLaunchData) headers.set("Authorization", `Bearer ${maxInitData}`);
      let response = await fetch(`${base}${path}`, { ...request, headers });
      if (response.status === 401 && canUseLaunchData && !headers.has("Authorization")) {
        signal.throwIfAborted();
        useLaunchData = true;
        headers.set("Authorization", `Bearer ${maxInitData}`);
        response = await fetch(`${base}${path}`, { ...request, headers });
      }
      let data: unknown;
      if (response.ok && options.responseType === "blob") data = await response.blob();
      else {
        const text = await response.text();
        try { data = text ? JSON.parse(text) : null; } catch { throw new ApiError("Сервер вернул некорректный ответ. Повторите попытку.", response.status); }
      }
      if (!response.ok) {
        const detail = data && typeof data === "object" && "detail" in data ? data.detail : undefined;
        throw new ApiError(typeof detail === "string" ? detail : response.status === 422 ? "Проверьте заполненные поля." : "Не удалось выполнить запрос. Повторите попытку.", response.status);
      }
      if (path === endpoints.logout) { maxInitData = ""; useLaunchData = false; }
      if ((options.method || options.body !== undefined) && path !== endpoints.presence && !/^\/issues\/[1-9]\d*\/presence$/.test(path)) cache.clear();
      else if (options.cacheFor) cache.set(cacheKey, { data, expires: Date.now() + options.cacheFor });
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (options.signal?.aborted) throw error;
      throw new ApiError(timeout.aborted ? "Сервер не ответил вовремя. Повторите попытку." : "Нет связи с сервером. Проверьте подключение и повторите попытку.", 0);
    }
  };
}

export const endpoints = {
  login: "/auth/max",
  localLogin: "/auth/local",
  logout: "/auth/logout",
  presence: "/auth/presence",
  me: "/me",
  notifications: "/me/notifications",
  registration: "/registration",
  registrationState: (houseId?: string) => houseId ? `/registration/houses/${encodeURIComponent(houseId)}` : "/registration",
  invitation: (houseId: string) => `/houses/${encodeURIComponent(houseId)}/invitation`,
  apartments: (house: string) => `/houses/${encodeURIComponent(house)}/apartments`,
  issues: (house: string) => `/houses/${encodeURIComponent(house)}/issues`,
  issue: (id: string) => `/issues/${encodeURIComponent(id)}`,
  issueMessages: (id: string) => `/issues/${encodeURIComponent(id)}/messages`,
  issuePresence: (id: string) => `/issues/${encodeURIComponent(id)}/presence`,
  messages: (apartment: number) => `/apartments/${apartment}/messages`,
  utilities: (apartment: number) => `/apartments/${apartment}/utilities`,
  readings: (meter: string) => `/meters/${encodeURIComponent(meter)}/readings`,
  cameras: (house: string) => `/houses/${encodeURIComponent(house)}/cameras`,
  preview: (camera: string) => `/cameras/${encodeURIComponent(camera)}/preview`,
  works: (house: string) => `/houses/${encodeURIComponent(house)}/works`,
  contacts: (house: string) => `/houses/${encodeURIComponent(house)}/contacts`,
  houseChat: (house: string) => `/houses/${encodeURIComponent(house)}/chat`,
};

export function maxLaunchData(): string {
  const webApp = (window as Window & { WebApp?: { initData?: string } }).WebApp;
  if (webApp?.initData) return webApp.initData;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const values = params.getAll("WebAppData");
  if (values.length) return values.length === 1 ? values[0] : "";
  // The router may already have removed the hash. This is the same recovery
  // source used by MAX Bridge, without depending on third-party sessionStorage.
  try {
    const initialUrl = window.performance.getEntriesByType("navigation")[0]?.name;
    const initialValues = initialUrl ? new URLSearchParams(new URL(initialUrl).hash.slice(1)).getAll("WebAppData") : [];
    return initialValues.length === 1 ? initialValues[0] : "";
  } catch { return ""; }
}

export function maxLaunchTarget() {
  const bridge = (window as Window & { WebApp?: { initDataUnsafe?: { start_param?: unknown } } }).WebApp;
  return launchTarget(maxLaunchData(), bridge?.initDataUnsafe?.start_param);
}
