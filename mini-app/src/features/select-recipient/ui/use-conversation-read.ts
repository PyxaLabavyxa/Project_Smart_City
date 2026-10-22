"use client";
import { useEffect, useRef, type RefObject } from "react";
import { useApi } from "@/shared/api/context";
import { number, record } from "@/shared/api/parse";
import { useNotifications } from "@/features/notifications/provider";

export function useConversationRead(apartmentId: number | undefined, neighbour: number, history: RefObject<HTMLDivElement | null>, version: string) {
  const api = useApi();
  const { update } = useNotifications();
  const schedule = useRef<() => void>(() => {});
  useEffect(() => {
    const list = history.current;
    if (!apartmentId || !list) return;
    let acknowledged = 0;
    let busy = false;
    let frame = 0;
    const controller = new AbortController();
    async function read() {
      if (busy || document.hidden || controller.signal.aborted || document.querySelector("dialog[open]")) return;
      const clip = list!.getBoundingClientRect();
      let seen = 0;
      for (const item of list!.querySelectorAll<HTMLElement>('[data-direction="incoming"][data-message-id]')) {
        const rect = item.getBoundingClientRect();
        if (Math.min(rect.bottom, clip.bottom, innerHeight) - Math.max(rect.top, clip.top, 0) >= Math.min(24, rect.height)) seen = Math.max(seen, Number(item.dataset.messageId));
      }
      if (!Number.isSafeInteger(seen) || seen <= acknowledged) return;
      busy = true;
      try {
        const result = record(await api("/me/inbox/read-conversation", { body: { apartment_id: apartmentId, sender_number: neighbour, through_message_id: seen }, signal: controller.signal }));
        if (!controller.signal.aborted) { acknowledged = seen; update(number(result.unread_count)); }
      } catch { /* Retry while visible; reading must not block replies. */ }
      finally { busy = false; }
    }
    const wake = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { void read(); }); };
    schedule.current = wake;
    const timer = window.setInterval(wake, 5000);
    list.addEventListener("scroll", wake);
    window.addEventListener("focus", wake); window.addEventListener("resize", wake);
    document.addEventListener("visibilitychange", wake);
    wake();
    return () => {
      schedule.current = () => {}; controller.abort(); cancelAnimationFrame(frame); clearInterval(timer);
      list.removeEventListener("scroll", wake);
      window.removeEventListener("focus", wake); window.removeEventListener("resize", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [api, apartmentId, neighbour, history, update]);
  useEffect(() => { schedule.current(); }, [version]);
}
