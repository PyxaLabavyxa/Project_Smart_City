const routes: Record<string, string> = {
  issues: "/issues",
  utilities: "/utilities",
  cameras: "/cameras",
  messages: "/messages",
};

// Launch data chooses only a known page; it never supplies an arbitrary URL.
export function launchRoute(initData: string, unsafeStartParam?: unknown): string | undefined {
  const values = new URLSearchParams(initData).getAll("start_param");
  if (values.length > 1) return undefined;
  const key = values[0] ?? unsafeStartParam;
  return typeof key === "string" && Object.hasOwn(routes, key) ? routes[key] : undefined;
}
