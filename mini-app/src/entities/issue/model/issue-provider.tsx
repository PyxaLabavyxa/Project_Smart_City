"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { demoIssues, type DemoIssue } from "./demo-issues";

type NewIssue = Pick<DemoIssue, "title" | "description" | "category" | "location">;
const IssueContext = createContext<{ issues: readonly DemoIssue[]; addIssue: (input: NewIssue) => string } | null>(null);

export function IssueProvider({ children }: { children: ReactNode }) {
  const [issues, setIssues] = useState<readonly DemoIssue[]>(demoIssues);
  function addIssue(input: NewIssue) {
    const id = "local-" + crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const issue: DemoIssue = { ...input, id, createdAt, address: "ул. Центральная, 18", status: "new", history: [{ status: "new", at: createdAt }] };
    setIssues(current => [issue, ...current]);
    return id;
  }
  return <IssueContext.Provider value={{ issues, addIssue }}>{children}</IssueContext.Provider>;
}
export function useIssues() {
  const context = useContext(IssueContext);
  if (!context) throw new Error("IssueProvider is required");
  return context;
}
