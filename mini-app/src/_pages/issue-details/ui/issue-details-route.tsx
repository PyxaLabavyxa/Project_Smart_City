"use client";
import { useCallback, useEffect } from "react";
import { useHouseSelection } from "@/entities/house";
import { useIssues } from "@/entities/issue";
import { parseIssue } from "@/entities/issue/model/api-gateway";
import { ApiError, endpoints } from "@/shared/api/client";
import { useApi } from "@/shared/api/context";
import { number, record } from "@/shared/api/parse";
import { useRemote } from "@/shared/api/use-remote";
import { IssueDetailsPage } from "./issue-details-page";
import { IssueNotFoundPage } from "./issue-not-found-page";
import { IssueCreated } from "./issue-created";
import { RequestState } from "@/shared/ui/navigation/request-state";
import { IssueChatPage } from "@/features/issue-chat/issue-chat-page";
import { ChatScreen } from "@/shared/ui/chat-screen";
export function IssueDetailsRoute({ id, view = "details" }: { id: string; view?: "details" | "chat" }) {
  return <IssueDetailsLoader key={`${id}:${view}`} id={id} view={view} />;
}

function IssueDetailsLoader({ id, view }: { id: string; view: "details" | "chat" }) {
  const api = useApi();
  const { house, choices, choose } = useHouseSelection();
  const { createdIssueId, dismissCreationNotice } = useIssues();
  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const row = record(await api(endpoints.issue(id), { signal }));
      return { houseId: String(number(row.house_id)), issue: parseIssue(row, house) };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }, [api, id, house]);
  const { data, loading, error, reload } = useRemote(load);
  const target = choices.find(choice => choice.houseId === data?.houseId);
  const anotherHouse = !!data && data.houseId !== house.id;
  useEffect(() => {
    if (anotherHouse && target) choose(target.id);
  }, [anotherHouse, target, choose]);
  if (loading || error) {
    const state = <RequestState loading={loading} error={error} reload={reload} />;
    return view === "chat" ? <ChatScreen title="Управляющая компания" subtitle={`Обращение №${id}`} backHref={`/issues/${id}`} backLabel="Назад к обращению">{state}</ChatScreen> : state;
  }
  if (anotherHouse) return <RequestState loading={!!target} error={target ? "" : "Обновите список квартир, чтобы открыть дом этого обращения."} reload={reload} />;
  const issue = data?.issue;
  if (!issue) return <IssueNotFoundPage />;
  if (view === "chat") return issue.mine ? <IssueChatPage issue={issue} /> : <IssueNotFoundPage />;
  if (createdIssueId === id) return <IssueCreated issue={issue} onOpen={() => { dismissCreationNotice(); window.scrollTo({ top: 0, behavior: "instant" }); }} />;
  return <IssueDetailsPage issue={issue} onChanged={reload} />;
}
