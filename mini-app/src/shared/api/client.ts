export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export type ApiClient = ReturnType<typeof createApiClient>;
export function createApiClient() {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
  return async (path: string, options: { body?: unknown; signal?: AbortSignal; keepalive?: boolean } = {}): Promise<unknown> => {
    const timeout = AbortSignal.timeout(15000);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    try {
      const response = await fetch(`${base}${path}`, {
        method: options.body === undefined ? "GET" : "POST",
        headers: options.body === undefined ? {} : { "Content-Type": "application/json" },
        credentials: "include",
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: "no-store", signal, keepalive: options.keepalive,
      });
      const text = await response.text();
      let data: unknown;
      try { data = text ? JSON.parse(text) : null; } catch { throw new ApiError("Сервер вернул некорректный ответ. Повторите попытку.", response.status); }
      if (!response.ok) {
        const detail = data && typeof data === "object" && "detail" in data ? data.detail : undefined;
        throw new ApiError(typeof detail === "string" ? detail : response.status === 422 ? "Проверьте заполненные поля." : "Не удалось выполнить запрос. Повторите попытку.", response.status);
      }
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
  apartments: (house: string) => `/houses/${encodeURIComponent(house)}/apartments`,
  issues: (house: string) => `/houses/${encodeURIComponent(house)}/issues`,
  issue: (id: string) => `/issues/${encodeURIComponent(id)}`,
  messages: (apartment: number) => `/apartments/${apartment}/messages`,
  utilities: (apartment: number) => `/apartments/${apartment}/utilities`,
  readings: (meter: string) => `/meters/${encodeURIComponent(meter)}/readings`,
  cameras: (house: string) => `/houses/${encodeURIComponent(house)}/cameras`,
  preview: (camera: string) => `/cameras/${encodeURIComponent(camera)}/preview`,
  works: (house: string) => `/houses/${encodeURIComponent(house)}/works`,
};

export function maxLaunchData(): string {
  const webApp = (window as Window & { WebApp?: { initData?: string } }).WebApp;
  if (webApp?.initData) return webApp.initData;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const values = params.getAll("WebAppData");
  return values.length === 1 ? values[0] : "";
}
