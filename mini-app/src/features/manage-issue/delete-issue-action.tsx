"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useIssues, type IssueRecord } from "@/entities/issue";
import { canDeleteIssue } from "@/entities/issue/model/issue-workflow";
import { ApiError } from "@/shared/api/client";
import { useConfirmation } from "@/shared/ui/confirmation";
import { Icon } from "@/shared/ui/icon";
import styles from "./manage-issue.module.css";

export function DeleteIssueAction({ issue, onChanged }: { issue: IssueRecord; onChanged: () => void }) {
  const { removeIssue, reload } = useIssues();
  const confirm = useConfirmation();
  const router = useRouter();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!canDeleteIssue(issue)) return null;

  async function remove() {
    if (pending.current) return;
    pending.current = true;
    try {
      if (!await confirm({ title: "Удалить обращение?", description: `Обращение №${issue.id} исчезнет из списка. Восстановить его в приложении нельзя.`, confirmLabel: "Удалить обращение", destructive: true })) return;
      setBusy(true); setError("");
      await removeIssue(issue.id);
      router.replace("/issues");
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        reload();
        router.replace("/issues");
      } else {
        setError(error instanceof Error ? error.message : "Не удалось удалить обращение. Попробуйте ещё раз.");
        if (error instanceof ApiError && error.status === 409) onChanged();
      }
    } finally {
      pending.current = false; setBusy(false);
    }
  }

  return <div className={styles.deleteArea}>
    <button type="button" className={styles.deleteButton} disabled={busy} onClick={() => void remove()}><Icon name="trash" />{busy ? "Удаляем…" : "Удалить обращение"}</button>
    {error && <p role="alert" className={styles.deleteError}>{error}</p>}
  </div>;
}
