"use client";
import { createContext, useContext, useRef, useState, useEffect, type ReactNode } from "react";
import { chatBody, type ChatDraftPhoto } from "@/shared/api/chat-photos";
import { useApi } from "@/shared/api/context";
import { endpoints } from "@/shared/api/client";
import { type IssueRecord } from "./issue";
import { useHouseSelection, fallbackLocation, resolveLocation, formatLocation, type HouseLocation } from "@/entities/house";
import { emptyDraft, initialReportStep, updateIssueDraft, type IssueDraft } from "./issue-draft";
import type { CreateIssueInput, IssueGateway } from "./issue-gateway";

type IssueState = {
  loading: boolean;
  error: string;
  reload: () => void;
  issues: readonly IssueRecord[];
  draft: IssueDraft;
  chatDrafts: Record<string, string>;
  chatSending: readonly string[];
  sendChat: (issueId: string, text: string, photos: readonly ChatDraftPhoto[]) => Promise<unknown>;
  chatPhotos: Record<string, ChatDraftPhoto[]>;
  setChatPhotos: (issueId: string, photos: ChatDraftPhoto[]) => void;
  setChatDraft: (issueId: string, text: string) => void;
  creating: boolean;
  createdIssueId: string | null;
  dismissCreationNotice: () => void;
  updateDraft: (patch: Partial<IssueDraft>) => void;
  startAt: (place: HouseLocation) => void;
  resetDraft: () => void;
  addIssue: (input: CreateIssueInput) => Promise<string>;
  removeIssue: (id: string) => Promise<void>;
  respondToResolution: (id: string, status: "completed" | "in-progress") => void;
};
const IssueContext = createContext<IssueState | null>(null);
export function IssueProvider({ children, gateway }: { children: ReactNode; gateway: IssueGateway }) {
  const api = useApi();
  const [chatSending, setChatSending] = useState<readonly string[]>([]);
  const chatPending = useRef(new Map<string, Promise<unknown>>());
  const chatRequests = useRef(new Map<string, { fingerprint: string; id: string }>());
  const [issues, setIssues] = useState<readonly IssueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  function reload() { setLoading(true); setError(""); setAttempt(value => value + 1); }
  useEffect(() => {
    const controller = new AbortController();
    gateway.list(controller.signal).then(items => {
      if (!controller.signal.aborted) setIssues(items);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Не удалось загрузить обращения");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [gateway, attempt]);
  const { house, selected } = useHouseSelection();
  const [draft, setDraft] = useState(() => emptyDraft(selected));
  const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({});
  const [chatPhotos, updateChatPhotos] = useState<Record<string, ChatDraftPhoto[]>>({});
  const [creating, setCreating] = useState(false);
  const [createdIssueId, setCreatedIssueId] = useState<string | null>(null);
  const pending = useRef<Promise<string> | null>(null);
  const requestId = useRef<string | null>(null);
  const requestPayload = useRef("");
  function sendChat(issueId: string, text: string, photos: readonly ChatDraftPhoto[]) {
    const pending = chatPending.current.get(issueId);
    if (pending) return pending;
    const fingerprint = JSON.stringify([text, photos.map(photo => photo.id)]);
    const previous = chatRequests.current.get(issueId);
    const id = previous?.fingerprint === fingerprint ? previous.id : crypto.randomUUID();
    chatRequests.current.set(issueId, { fingerprint, id });
    setChatSending(current => [...current, issueId]);
    const task = api(endpoints.issueMessages(issueId) + (photos.length ? "/with-photos" : ""), { body: chatBody({ text, request_id: id }, photos) }).then(message => {
      chatRequests.current.delete(issueId);
      setChatDrafts(current => current[issueId]?.trim() === text ? { ...current, [issueId]: "" } : current);
      updateChatPhotos(current => ({ ...current, [issueId]: (current[issueId] ?? []).filter(photo => !photos.some(sent => sent.id === photo.id)) }));
      return message;
    }).finally(() => {
      chatPending.current.delete(issueId);
      setChatSending(current => current.filter(id => id !== issueId));
    });
    chatPending.current.set(issueId, task);
    return task;
  }
  function resetDraft() { setDraft(emptyDraft(selected)); requestId.current = null; }
  async function removeIssue(id: string) {
    await gateway.remove(id);
    setIssues(current => current.filter(issue => issue.id !== id));
    setCreatedIssueId(current => current === id ? null : current);
    setChatDrafts(current => { const next = { ...current }; delete next[id]; return next; });
    updateChatPhotos(current => { const next = { ...current }; delete next[id]; return next; });
    reload();
  }
  function respondToResolution() {
    throw new Error("Подтверждение решения пока недоступно");
  }
  function addIssue(input: CreateIssueInput): Promise<string> {
    if (pending.current) return pending.current;
    const payload = JSON.stringify(input);
    if (!requestId.current || requestPayload.current !== payload) {
      requestId.current = crypto.randomUUID();
      requestPayload.current = payload;
    }
    setCreating(true);
    const id = requestId.current;
    const task = Promise.resolve().then(() => gateway.create(input, id)).then(issue => {
      setIssues(current => current.some(item => item.id === issue.id) ? current : [issue, ...current]);
      resetDraft();
      setCreatedIssueId(issue.id);
      return issue.id;
    }).finally(() => { pending.current = null; setCreating(false); });
    pending.current = task;
    return task;
  }
  const locatedIssues = issues.map(issue => {
    const place = resolveLocation(house, issue.place);
    return { ...issue, place, location: place ? formatLocation(place) : issue.location };
  });
  const draftPlace = fallbackLocation(house, draft.place);
  const currentDraft = updateIssueDraft(draft, { place: draftPlace });
  return <IssueContext.Provider value={{ chatSending, sendChat, chatPhotos, setChatPhotos: (issueId, photos) => updateChatPhotos(current => ({ ...current, [issueId]: photos })), loading, error, reload, issues: locatedIssues, draft: currentDraft, chatDrafts, setChatDraft: (id, text) => setChatDrafts(current => ({ ...current, [id]: text })), creating, createdIssueId, dismissCreationNotice: () => setCreatedIssueId(null), updateDraft: patch => setDraft(current => updateIssueDraft({ ...current, place: fallbackLocation(house, current.place) }, patch)), startAt: place => setDraft(current => updateIssueDraft(current, { place, step: initialReportStep(place) })), resetDraft, addIssue, removeIssue, respondToResolution }}>{children}</IssueContext.Provider>;
}
export function useIssues() {
  const context = useContext(IssueContext);
  if (!context) throw new Error("IssueProvider is required");
  return context;
}
