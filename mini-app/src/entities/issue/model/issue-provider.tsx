"use client";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { demoIssues, type DemoIssue } from "./demo-issues";
import { defaultPlace, type HouseLocation } from "@/entities/house";
import { emptyDraft, type IssueDraft } from "./issue-draft";
import type { CreateIssueInput, IssueGateway } from "./issue-gateway";

type IssueState = {
  issues: readonly DemoIssue[];
  draft: IssueDraft;
  updateDraft: (patch: Partial<IssueDraft>) => void;
  startAt: (place: HouseLocation) => void;
  resetDraft: () => void;
  addIssue: (input: CreateIssueInput) => Promise<string>;
};
const IssueContext = createContext<IssueState | null>(null);
export function IssueProvider({ children, gateway }: { children: ReactNode; gateway: IssueGateway }) {
  const [issues, setIssues] = useState<readonly DemoIssue[]>(demoIssues);
  const [draft, setDraft] = useState(() => emptyDraft(defaultPlace));
  const pending = useRef<Promise<string> | null>(null);
  const requestId = useRef<string | null>(null);
  const requestPayload = useRef("");
  function resetDraft() { setDraft(emptyDraft(defaultPlace)); requestId.current = null; }
  function addIssue(input: CreateIssueInput): Promise<string> {
    if (pending.current) return pending.current;
    const payload = JSON.stringify(input);
    if (!requestId.current || requestPayload.current !== payload) {
      requestId.current = crypto.randomUUID();
      requestPayload.current = payload;
    }
    const task = gateway.create(input, requestId.current).then(issue => {
      setIssues(current => current.some(item => item.id === issue.id) ? current : [issue, ...current]);
      resetDraft();
      return issue.id;
    }).finally(() => { pending.current = null; });
    pending.current = task;
    return task;
  }
  return <IssueContext.Provider value={{ issues, draft, updateDraft: patch => setDraft(current => ({ ...current, ...patch })), startAt: place => setDraft(current => ({ ...current, place, step: 0 })), resetDraft, addIssue }}>{children}</IssueContext.Provider>;
}
export function useIssues() {
  const context = useContext(IssueContext);
  if (!context) throw new Error("IssueProvider is required");
  return context;
}
