"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { maxLaunchData } from "@/shared/api/client";
import { launchRoute } from "@/shared/api/launch-route";

export function LaunchNavigation() {
  const router = useRouter();
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const bridge = (window as Window & {
      WebApp?: { initDataUnsafe?: { start_param?: unknown } };
    }).WebApp;
    const target = launchRoute(maxLaunchData(), bridge?.initDataUnsafe?.start_param);
    if (target) router.replace(target);
  }, [router]);
  return null;
}
