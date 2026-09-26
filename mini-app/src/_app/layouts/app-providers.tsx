"use client";
import type { ReactNode } from "react";
import { HouseSelectionProvider } from "@/entities/house";
import { IssueProvider } from "@/entities/issue";
import { mockIssueGateway } from "@/mocks/issue-gateway";
import { MessageProvider } from "@/entities/message";
import { mockMessageGateway, demoMessages } from "@/mocks/message-gateway";
export function AppProviders({ children }: { children: ReactNode }) {
  return <HouseSelectionProvider><IssueProvider gateway={mockIssueGateway}><MessageProvider gateway={mockMessageGateway} initialMessages={demoMessages}>{children}</MessageProvider></IssueProvider></HouseSelectionProvider>;
}
