const routes: Record<string, string> = {
  home: "/",
  report: "/issues/new",
  contacts: "/contacts",
  issues: "/issues",
  utilities: "/utilities",
  cameras: "/cameras",
  messages: "/messages",
};

export type LaunchTarget = { href: string; houseId?: string };

export function deferLaunchOnboarding(target?: LaunchTarget): boolean {
  return !!target && target.href !== "/";
}

export function launchTarget(initData: string, unsafeStartParam?: unknown): LaunchTarget | undefined {
  const values = new URLSearchParams(initData).getAll("start_param");
  if (values.length > 1) return undefined;
  const key = values[0] ?? unsafeStartParam;
  if (typeof key !== "string") return undefined;
  if (Object.hasOwn(routes, key)) return { href: routes[key] };
  const house = /^(home|report|issues|contacts)_house_([1-9]\d{0,9})$/.exec(key);
  if (house && Number(house[2]) <= 2147483647) return { href: routes[house[1]], houseId: house[2] };
  const issue = /^issue_([1-9]\d{0,9})$/.exec(key);
  if (issue && Number(issue[1]) <= 2147483647) return { href: `/issues/${issue[1]}/chat` };
  return undefined;
}

export function launchRoute(initData: string, unsafeStartParam?: unknown): string | undefined {
  return launchTarget(initData, unsafeStartParam)?.href;
}

// Keep the public house hint in the page URL while registration is in progress.
// It selects a form destination; API membership checks remain authoritative.
export function browserLaunchTarget(search: string): LaunchTarget | undefined {
  const values = new URLSearchParams(search).getAll("startapp");
  return values.length === 1 ? launchTarget("", values[0]) : undefined;
}

export function launchNavigationHref(target?: LaunchTarget): string | undefined {
  if (!target) return undefined;
  if (!target.houseId) return target.href;
  const section = Object.keys(routes).find(key => routes[key] === target.href);
  return section ? `${target.href}?startapp=${section}_house_${target.houseId}` : target.href;
}
