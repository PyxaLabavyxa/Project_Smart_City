"use client";

import { useEffect, useRef, type RefObject } from "react";
import { endpoints } from "@/shared/api/client";
import { useApi } from "@/shared/api/context";
import { createChatPresence } from "./presence";

export function useChatPresence({ issueId, enabled, refreshedAt, section, history }: {
  issueId: string;
  enabled: boolean;
  refreshedAt: number;
  section: RefObject<HTMLElement | null>;
  history: RefObject<HTMLOListElement | null>;
}) {
  const api = useApi();
  const latestRefresh = useRef(0);
  const schedule = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) return;
    const presence = createChatPresence(crypto.randomUUID(), value => {
      void api(endpoints.issuePresence(issueId), { body: value, keepalive: true }).catch(() => {});
    });
    const openedAt = Date.now();
    let focused = document.hasFocus();
    let leaving = false;
    let frame = 0;
    function update(heartbeat = false) {
      const rect = section.current?.getBoundingClientRect();
      const bottom = window.innerHeight - 80;
      const visible = !leaving && focused && !document.hidden && !document.querySelector("dialog[open]")
        && !!rect && rect.bottom > 0 && rect.top < bottom;
      let seen: number | null = null;
      const list = history.current;
      if (visible && list) {
        const clip = list.getBoundingClientRect();
        for (const message of list.querySelectorAll<HTMLElement>("[data-message-id]")) {
          const messageRect = message.getBoundingClientRect();
          const overlap = Math.min(messageRect.bottom, clip.bottom, bottom) - Math.max(messageRect.top, clip.top, 0);
          if (overlap >= Math.min(24, messageRect.height)) {
            const id = Number(message.dataset.messageId);
            if (Number.isSafeInteger(id) && id > 0) seen = Math.max(seen ?? 0, id);
          }
        }
      }
      // A failed history load must not keep unread messages silent indefinitely.
      const fresh = Date.now() - latestRefresh.current < 25000 || Date.now() - openedAt < 20000;
      presence.update(visible, fresh, seen, heartbeat);
    }
    const onChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => update());
    };
    const onFocus = () => { focused = true; onChange(); };
    const onBlur = () => { focused = false; update(); };
    const onHide = () => { leaving = true; update(); };
    const onShow = () => { leaving = false; focused = document.hasFocus(); onChange(); };
    schedule.current = onChange;
    const observer = new IntersectionObserver(onChange);
    if (section.current) observer.observe(section.current);
    const timer = window.setInterval(() => update(true), 10000);
    document.addEventListener("visibilitychange", onChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    onChange();
    return () => {
      schedule.current = () => {};
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
      presence.close();
    };
  }, [api, issueId, enabled, section, history]);

  useEffect(() => {
    latestRefresh.current = refreshedAt;
    schedule.current();
  }, [refreshedAt]);
}
