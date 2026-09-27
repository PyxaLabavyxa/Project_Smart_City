"use client";
import type { ReactNode } from "react";
import { HouseSelectionProvider, useHouseSelection } from "@/entities/house";
import { IssueProvider } from "@/entities/issue";
import { createMockIssueGateway } from "@/mocks/issue-gateway";
import { MessageProvider } from "@/entities/message";
import { createMockMessageGateway, demoMessages } from "@/mocks/message-gateway";
export function AppProviders({ children }: { children: ReactNode }) {
  return <HouseSelectionProvider><HouseServices>{children}</HouseServices></HouseSelectionProvider>;
}
function HouseServices({ children }: { children: ReactNode }) {
  const { house } = useHouseSelection();
  return <IssueProvider gateway={createMockIssueGateway(house)}><MessageProvider gateway={createMockMessageGateway(house)} initialMessages={demoMessages}>{children}</MessageProvider></IssueProvider>;
}
