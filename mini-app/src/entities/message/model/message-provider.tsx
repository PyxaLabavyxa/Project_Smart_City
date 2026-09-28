"use client";
import { createContext, useContext, useRef, useState, useEffect, type ReactNode } from "react";
import type { Message, MessageGateway } from "./message";
import type { HouseLocation } from "@/entities/house";
type State = { loading: boolean; error: string; reload: () => void; messages: readonly Message[]; drafts: Record<number, string>; sending: readonly number[]; setDraft: (apartment: number, text: string) => void; send: (place: HouseLocation, text: string) => Promise<void> };
const Context = createContext<State | null>(null);
export function MessageProvider({ children, gateway, initialMessages = [] }: { children: ReactNode; gateway: MessageGateway; initialMessages?: readonly Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [sending, setSending] = useState<readonly number[]>([]);
  const pending = useRef(new Map<number, Promise<void>>());
  const requests = useRef(new Map<number, { text: string; id: string }>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  function reload() { setLoading(true); setError(""); setAttempt(value => value + 1); }
  useEffect(() => {
    const controller = new AbortController();
    (gateway.list?.(controller.signal) ?? Promise.resolve([])).then(items => {
      if (!controller.signal.aborted) setMessages(current => [...items, ...current.filter(item => !items.some(row => row.id === item.id))]);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Не удалось загрузить сообщения");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [gateway, attempt]);
  function send(place: HouseLocation, text: string) {
    if (place.zone !== "apartment") return Promise.reject(new Error("Выберите квартиру"));
    const apartment = place.apartment;
    const existing = pending.current.get(apartment);
    if (existing) return existing;
    setSending(current => [...current, apartment]);
    const previous = requests.current.get(apartment);
    const requestId = previous?.text === text ? previous.id : crypto.randomUUID();
    requests.current.set(apartment, { text, id: requestId });
    const task = Promise.resolve().then(() => gateway.send(place, text, requestId)).then(message => {
      requests.current.delete(apartment);
      setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message]);
      setDrafts(current => current[apartment] === text ? { ...current, [apartment]: "" } : current);
    }).finally(() => {
      pending.current.delete(apartment);
      setSending(current => current.filter(value => value !== apartment));
    });
    pending.current.set(apartment, task);
    return task;
  }
  return <Context.Provider value={{ loading, error, reload, messages, drafts, sending, setDraft: (apartment, text) => setDrafts(current => ({ ...current, [apartment]: text })), send }}>{children}</Context.Provider>;
}
export function useMessages() { const value = useContext(Context); if (!value) throw new Error("MessageProvider is required"); return value; }
