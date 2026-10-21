const routes: Record<string, string> = {
  report: "/issues/new",
  contacts: "/contacts",
  issues: "/issues",
  utilities: "/utilities",
  cameras: "/cameras",
  messages: "/messages",
};

export type LaunchTarget = { href: string; houseId?: string };

export function launchTarget(initData: string, unsafeStartParam?: unknown): LaunchTarget | undefined {
  const values = new URLSearchParams(initData).getAll("start_param");
  if (values.length > 1) return undefined;
  const key = values[0] ?? unsafeStartParam;
  if (typeof key !== "string") return undefined;
  if (Object.hasOwn(routes, key)) return { href: routes[key] };
  const house = /^(report|issues|contacts)_house_([1-9]\d{0,9})$/.exec(key);
  if (house && Number(house[2]) <= 2147483647) return { href: routes[house[1]], houseId: house[2] };
  const issue = /^issue_([1-9]\d{0,9})$/.exec(key);
  if (issue && Number(issue[1]) <= 2147483647) return { href: `/issues/${issue[1]}/chat` };
  return undefined;
}

export function launchRoute(initData: string, unsafeStartParam?: unknown): string | undefined {
  return launchTarget(initData, unsafeStartParam)?.href;
}
