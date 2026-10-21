"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function LaunchNavigation({ target }: { target?: string }) {
  const router = useRouter();
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    if (target) router.replace(target);
  }, [router, target]);
  return null;
}
