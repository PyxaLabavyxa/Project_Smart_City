"use client";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useHouseSelection } from "@/entities/house";
import { useIssues } from "@/entities/issue";
import { useMessages } from "@/entities/message";
import { useUtilityAccount } from "@/entities/utilities";
import { StartupScreen } from "@/shared/ui/startup-screen";
import { RefreshButton } from "@/shared/ui/refresh-button";

/** Providers keep loading in parallel while the first home render stays hidden. */
export function HomeStartup({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { apartmentsState } = useHouseSelection();
  const issues = useIssues();
  const messages = useMessages();
  const utilities = useUtilityAccount();
  const [opened, setOpened] = useState(false);
  const pending = apartmentsState.loading || issues.loading || messages.loading || utilities.loading;
  // A failed optional service must not hide navigation to working sections.
  const error = apartmentsState.error;
  const ready = !pending && !error;
  if (!opened && (pathname !== "/" || ready)) setOpened(true);
  if (pathname !== "/" || opened || ready) return children;
  function retry() {
    for (const state of [apartmentsState, issues, messages, utilities]) {
      if (state.error && !state.loading) state.reload();
    }
  }
  return <StartupScreen status="Загружаем обращения, сообщения и данные дома…" error={error}
    actions={error ? <RefreshButton onRefresh={retry} loading={pending}>Повторить загрузку</RefreshButton> : undefined} />;
}
