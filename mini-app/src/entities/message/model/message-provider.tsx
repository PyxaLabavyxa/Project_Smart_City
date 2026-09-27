"use client";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import type { Message, MessageGateway } from "./message";
import type { HouseLocation } from "@/entities/house";
type State = { messages: readonly Message[]; drafts: Record<number, string>; sending: readonly number[]; setDraft: (apartment: number, text: string) => void; send: (place: HouseLocation, text: string) => Promise<void> };
const Context = createContext<State | null>(null);
export function MessageProvider({ children, gateway, initialMessages = [] }: { children: ReactNode; gateway: MessageGateway; initialMessages?: readonly Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [sending, setSending] = useState<readonly number[]>([]);
  const pending = useRef(new Map<number, Promise<void>>());
  function send(place: HouseLocation, text: string) {
    if (place.zone !== "apartment") return Promise.reject(new Error("Выберите квартиру"));
    const apartment = place.apartment;
    const existing = pending.current.get(apartment);
    if (existing) return existing;
    setSending(current => [...current, apartment]);
    const task = Promise.resolve().then(() => gateway.send(place, text, crypto.randomUUID())).then(message => {
      setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message]);
      setDrafts(current => current[apartment] === text ? { ...current, [apartment]: "" } : current);
    }).finally(() => {
      pending.current.delete(apartment);
      setSending(current => current.filter(value => value !== apartment));
    });
    pending.current.set(apartment, task);
    return task;
  }
  return <Context.Provider value={{ messages, drafts, sending, setDraft: (apartment, text) => setDrafts(current => ({ ...current, [apartment]: text })), send }}>{children}</Context.Provider>;
}
export function useMessages() { const value = useContext(Context); if (!value) throw new Error("MessageProvider is required"); return value; }
