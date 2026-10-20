"use client";
import { type IssueRecord } from "@/entities/issue";
import { ChatScreen } from "@/shared/ui/chat-screen";
import { Icon } from "@/shared/ui/icon";
import { IssueConversation } from "./issue-conversation";

export function IssueChatPage({ issue }: { issue: IssueRecord }) {
  return <ChatScreen title="Управляющая компания" subtitle={`Обращение №${issue.id} · ${issue.title}`} avatar={<Icon name="home" size={23} />} backHref={`/issues/${issue.id}`} backLabel="Назад к обращению">
    <IssueConversation key={issue.id} issueId={issue.id} />
  </ChatScreen>;
}
