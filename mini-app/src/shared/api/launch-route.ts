const routes: Record<string, string> = {
  issues: "/issues",
  utilities: "/utilities",
  cameras: "/cameras",
  messages: "/messages",
};

export function launchRoute(initData: string, unsafeStartParam?: unknown): string | undefined {
  const values = new URLSearchParams(initData).getAll("start_param");
  if (values.length > 1) return undefined;
  const key = values[0] ?? unsafeStartParam;
  if (typeof key !== "string") return undefined;
  if (Object.hasOwn(routes, key)) return routes[key];
  const issue = /^issue_([1-9]\d{0,9})$/.exec(key);
  if (issue && Number(issue[1]) <= 2147483647) return `/issues/${issue[1]}?chat=1`;
  return undefined;
}
