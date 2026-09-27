import type { DemoIssue } from "./demo-issues";
import type { HouseLocation } from "@/entities/house";
export type CreateIssueInput = { place: HouseLocation; category: string; title: string; description: string };
export interface IssueGateway {
  create(input: CreateIssueInput, requestId: string): Promise<DemoIssue>;
}
