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
import styles from "./issue-details.module.css";
import { RequestState } from "@/shared/ui/navigation/request-state";
export function IssueDetailsRoute({ id }: { id: string }) {
  return <IssueDetailsLoader key={id} id={id} />;
}

function IssueDetailsLoader({ id }: { id: string }) {
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
  if (loading || error) return <RequestState loading={loading} error={error} reload={reload} />;
  if (anotherHouse) return <RequestState loading={!!target} error={target ? "" : "Обновите список квартир, чтобы открыть дом этого обращения."} reload={reload} />;
  const issue = data?.issue;
  return issue ? <>
    {createdIssueId === id && <div className={styles.success} role="status"><div><strong>Обращение создано</strong><p>Место и описание сохранены. Здесь можно следить за статусом.</p></div><button type="button" aria-label="Закрыть подтверждение" onClick={dismissCreationNotice}>×</button></div>}
    <IssueDetailsPage issue={issue} />
  </> : <IssueNotFoundPage />;
}
