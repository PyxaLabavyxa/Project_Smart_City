"use client";
import { createContext, useContext, useRef, useState, useEffect, type ReactNode } from "react";
import { type IssueRecord } from "./issue";
import { useHouseSelection, fallbackLocation, resolveLocation, formatLocation, type HouseLocation } from "@/entities/house";
import { emptyDraft, type IssueDraft } from "./issue-draft";
import { categoriesForFloor } from "./issue-filters";
import type { CreateIssueInput, IssueGateway } from "./issue-gateway";

type IssueState = {
  loading: boolean;
  error: string;
  reload: () => void;
  issues: readonly IssueRecord[];
  draft: IssueDraft;
  creating: boolean;
  createdIssueId: string | null;
  dismissCreationNotice: () => void;
  updateDraft: (patch: Partial<IssueDraft>) => void;
  startAt: (place: HouseLocation) => void;
  resetDraft: () => void;
  addIssue: (input: CreateIssueInput) => Promise<string>;
  respondToResolution: (id: string, status: "completed" | "in-progress") => void;
};
const IssueContext = createContext<IssueState | null>(null);
export function IssueProvider({ children, gateway }: { children: ReactNode; gateway: IssueGateway }) {
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
  const [creating, setCreating] = useState(false);
  const [createdIssueId, setCreatedIssueId] = useState<string | null>(null);
  const pending = useRef<Promise<string> | null>(null);
  const requestId = useRef<string | null>(null);
  const requestPayload = useRef("");
  function resetDraft() { setDraft(emptyDraft(selected)); requestId.current = null; }
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
  const currentDraft = { ...draft, place: draftPlace, category: categoriesForFloor(draftPlace.floor).some(category => category === draft.category) ? draft.category : "" };
  return <IssueContext.Provider value={{ loading, error, reload, issues: locatedIssues, draft: currentDraft, creating, createdIssueId, dismissCreationNotice: () => setCreatedIssueId(null), updateDraft: patch => setDraft(current => ({ ...current, place: fallbackLocation(house, current.place), ...patch })), startAt: place => setDraft(current => ({ ...current, place, step: 0 })), resetDraft, addIssue, respondToResolution }}>{children}</IssueContext.Provider>;
}
export function useIssues() {
  const context = useContext(IssueContext);
  if (!context) throw new Error("IssueProvider is required");
  return context;
}
