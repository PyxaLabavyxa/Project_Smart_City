"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi } from "@/shared/api/context";
import { number, record } from "@/shared/api/parse";
import { Icon } from "@/shared/ui/icon";
import styles from "./notifications.module.css";

const Context = createContext<{ count: number; update: (value: number) => void; navigate: (href: string) => void } | null>(null);
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [count, setCount] = useState(0);
  const generation = useRef(0);
  const update = useCallback((value: number) => { generation.current++; setCount(value); }, []);
  const router = useRouter();
  const [destination, setDestination] = useState<{ href: string } | null>(null);
  const navigate = useCallback((href: string) => setDestination({ href }), []);
  // This provider survives the apartment switch. Navigate after that switch commits,
  // otherwise Next can discard the transition when the old house subtree unmounts.
  useEffect(() => { if (destination) router.push(destination.href); }, [destination, router]);
  useEffect(() => {
    let current: AbortController | undefined;
    const poll = async () => {
      if (document.visibilityState !== "visible" || current) return;
      const controller = new AbortController(); current = controller;
      const version = generation.current;
      try {
        const result = record(await api("/me/inbox/count", { signal: controller.signal }));
        if (!controller.signal.aborted && version === generation.current) setCount(number(result.unread_count));
      } catch { /* Keep the last count; the inbox page exposes connection errors. */ }
      finally { if (current === controller) current = undefined; }
    };
    const wake = () => void poll();
    wake();
    const timer = window.setInterval(wake, 20000);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => { current?.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", wake); window.removeEventListener("focus", wake); };
  }, [api]);
  return <Context value={{ count, update, navigate }}>{children}</Context>;
}
export function useNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error("NotificationsProvider is required");
  return context;
}
export function NotificationBell() {
  const { count } = useNotifications();
  return <Link data-tour="notifications-bell" href="/notifications" className={styles.bell} aria-label={count ? `Уведомления: ${count} непрочитанных` : "Уведомления"}>
    <Icon name="bell" size={24} />{count > 0 && <span className={styles.badge} aria-hidden="true">{count > 99 ? "99+" : count}</span>}
  </Link>;
}
