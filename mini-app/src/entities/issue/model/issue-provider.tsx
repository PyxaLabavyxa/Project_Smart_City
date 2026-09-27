"use client";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { demoIssues, type DemoIssue } from "./demo-issues";
import { defaultPlace, useHouseSelection, fallbackLocation, resolveLocation, formatLocation, type HouseLocation } from "@/entities/house";
import { withStatus } from "./issue-workflow";
import { emptyDraft, type IssueDraft } from "./issue-draft";
import type { CreateIssueInput, IssueGateway } from "./issue-gateway";

type IssueState = {
  issues: readonly DemoIssue[];
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
  const [issues, setIssues] = useState<readonly DemoIssue[]>(demoIssues);
  const [draft, setDraft] = useState(() => emptyDraft(defaultPlace));
  const [creating, setCreating] = useState(false);
  const [createdIssueId, setCreatedIssueId] = useState<string | null>(null);
  const { house, selected } = useHouseSelection();
  const pending = useRef<Promise<string> | null>(null);
  const requestId = useRef<string | null>(null);
  const requestPayload = useRef("");
  function resetDraft() { setDraft(emptyDraft(selected)); requestId.current = null; }
  function respondToResolution(id: string, status: "completed" | "in-progress") {
    const at = new Date().toISOString();
    setIssues(current => current.map(issue => issue.id === id && issue.mine && issue.status === "awaiting-confirmation" ? withStatus(issue, status, at) : issue));
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
  const currentDraft = { ...draft, place: fallbackLocation(house, draft.place) };
  return <IssueContext.Provider value={{ issues: locatedIssues, draft: currentDraft, creating, createdIssueId, dismissCreationNotice: () => setCreatedIssueId(null), updateDraft: patch => setDraft(current => ({ ...current, place: fallbackLocation(house, current.place), ...patch })), startAt: place => setDraft(current => ({ ...current, place, step: 0 })), resetDraft, addIssue, respondToResolution }}>{children}</IssueContext.Provider>;
}
export function useIssues() {
  const context = useContext(IssueContext);
  if (!context) throw new Error("IssueProvider is required");
  return context;
}
