"use client";
import { createContext, useContext, useRef, useState, useEffect, type ReactNode } from "react";
import type { ChatDraftPhoto } from "@/shared/api/chat-photos";
import type { Message, MessageGateway } from "./message";
import type { HouseLocation } from "@/entities/house";
type State = { loading: boolean; error: string; reload: () => void; messages: readonly Message[]; drafts: Record<number, string>; sending: readonly number[]; setDraft: (apartment: number, text: string) => void; photoDrafts: Record<number, ChatDraftPhoto[]>; setPhotoDraft: (apartment: number, photos: ChatDraftPhoto[]) => void; send: (place: HouseLocation, text: string, photos?: readonly ChatDraftPhoto[]) => Promise<void> };
const Context = createContext<State | null>(null);
export function MessageProvider({ children, gateway, initialMessages = [] }: { children: ReactNode; gateway: MessageGateway; initialMessages?: readonly Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [photoDrafts, setPhotoDrafts] = useState<Record<number, ChatDraftPhoto[]>>({});
  const [sending, setSending] = useState<readonly number[]>([]);
  const pending = useRef(new Map<number, Promise<void>>());
  const requests = useRef(new Map<number, { text: string; id: string }>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  function reload() { setLoading(true); setError(""); setAttempt(value => value + 1); }
  useEffect(() => {
    let controller: AbortController | undefined;
    let stopped = false;
    async function poll() {
      if (document.hidden || controller || stopped) return;
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const items = await (gateway.list?.(signal) ?? Promise.resolve([]));
        if (!signal.aborted) {
          setMessages(current => [...items, ...current.filter(item => !items.some(row => row.id === item.id))]);
          setError("");
        }
      } catch (error) {
        if (!signal.aborted) setError(error instanceof Error ? error.message : "Не удалось загрузить сообщения");
      } finally {
        if (!signal.aborted) setLoading(false);
        controller = undefined;
      }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    const resume = () => { if (!document.hidden) void poll(); };
    document.addEventListener("visibilitychange", resume);
    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [gateway, attempt]);
  function send(place: HouseLocation, text: string, photos: readonly ChatDraftPhoto[] = []) {
    if (place.zone !== "apartment") return Promise.reject(new Error("Выберите квартиру"));
    const apartment = place.apartment;
    const existing = pending.current.get(apartment);
    if (existing) return existing;
    setSending(current => [...current, apartment]);
    const previous = requests.current.get(apartment);
    const fingerprint = JSON.stringify([text, photos.map(p => p.id)]);
    const requestId = previous?.text === fingerprint ? previous.id : crypto.randomUUID();
    requests.current.set(apartment, { text: fingerprint, id: requestId });
    const task = Promise.resolve().then(() => gateway.send(place, text, requestId, photos)).then(message => {
      requests.current.delete(apartment);
      setPhotoDrafts(current => ({ ...current, [apartment]: (current[apartment] ?? []).filter(p => !photos.some(sent => sent.id === p.id)) }));
      setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message]);
      setDrafts(current => current[apartment] === text ? { ...current, [apartment]: "" } : current);
    }).finally(() => {
      pending.current.delete(apartment);
      setSending(current => current.filter(value => value !== apartment));
    });
    pending.current.set(apartment, task);
    return task;
  }
  return <Context.Provider value={{ photoDrafts, setPhotoDraft: (apartment, photos) => setPhotoDrafts(current => ({ ...current, [apartment]: photos })), loading, error, reload, messages, drafts, sending, setDraft: (apartment, text) => setDrafts(current => ({ ...current, [apartment]: text })), send }}>{children}</Context.Provider>;
}
export function useMessages() { const value = useContext(Context); if (!value) throw new Error("MessageProvider is required"); return value; }
