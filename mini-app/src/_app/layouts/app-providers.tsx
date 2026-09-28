"use client";
import { useState, type ReactNode } from "react";
import { createMockUtilitiesGateway } from "@/mocks/utility-account";
import { UtilitiesProvider } from "@/entities/utilities";
import { HouseSelectionProvider, useHouseSelection, demoHouse } from "@/entities/house";
import { IssueProvider } from "@/entities/issue";
import { createMockIssueGateway } from "@/mocks/issue-gateway";
import { MessageProvider } from "@/entities/message";
import { createMockMessageGateway, demoMessages } from "@/mocks/message-gateway";
export function AppProviders({ children }: { children: ReactNode }) {
  return <HouseSelectionProvider house={demoHouse}><HouseServices>{children}</HouseServices></HouseSelectionProvider>;
}
function HouseServices({ children }: { children: ReactNode }) {
  const { house } = useHouseSelection();
  return <IssueProvider gateway={createMockIssueGateway(house)}><MessageProvider gateway={createMockMessageGateway(house)} initialMessages={demoMessages}><ResidentUtilities key={`${house.id}:${house.residentApartment}`}>{children}</ResidentUtilities></MessageProvider></IssueProvider>;
}
function ResidentUtilities({ children }: { children: ReactNode }) {
  const [gateway] = useState(createMockUtilitiesGateway);
  return <UtilitiesProvider gateway={gateway}>{children}</UtilitiesProvider>;
}
