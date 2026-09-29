import type { IssueRecord } from "./issue";
import type { HouseLocation } from "@/entities/house";
import type { DraftPhoto } from "./issue-draft";
export type CreateIssueInput = { place: HouseLocation; category: string; title: string; description: string; photos?: DraftPhoto[] };
export interface IssueGateway {
  list(signal?: AbortSignal): Promise<readonly IssueRecord[]>;
  get(id: string, signal?: AbortSignal): Promise<IssueRecord>;
  create(input: CreateIssueInput, requestId: string): Promise<IssueRecord>;
}
