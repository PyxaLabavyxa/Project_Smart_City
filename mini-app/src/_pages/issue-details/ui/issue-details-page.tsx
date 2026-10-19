import { PlaceLink } from "@/entities/house";
import { Icon } from "@/shared/ui/icon";
import { formatIssueDate, IssueStatus, type IssueRecord } from "@/entities/issue";
import { IssueCategoryIcon } from "@/entities/issue/ui/issue-category-icon";
import { IssueHistory } from "./issue-history";
import styles from "./issue-details.module.css";
import { IssueWorkflow } from "@/features/manage-issue";
import { IssuePhotos } from "@/entities/issue/ui/issue-photos";
import { IssueConversation } from "@/features/issue-chat/issue-conversation";
export function IssueDetailsPage({ issue }: {issue:IssueRecord}) {
 return <>
  <header className={styles.heading}><div className={styles.titleRow}><h1>{issue.title}</h1><IssueStatus status={issue.status} /></div><p className={styles.meta}>№{issue.id} · <time dateTime={issue.createdAt}>{formatIssueDate(issue.createdAt)}</time></p><div className={styles.placeRow}><span><IssueCategoryIcon category={issue.category} />{issue.category}</span>{issue.place ? <PlaceLink place={issue.place}><Icon name="pin" />{issue.location}</PlaceLink> : <span>{issue.location}</span>}</div></header>
  <div className={styles.layout}><section className={styles.info} aria-labelledby="issue-description"><div className={styles.description}><h2 id="issue-description">Описание</h2><p>{issue.description}</p></div><IssuePhotos issueId={issue.id} ids={issue.photoIds ?? []} /></section><IssueHistory issue={issue} /></div>
  <details className={styles.workflowDetails}><summary>Подробности и ход работ</summary><p>{issue.address}</p>{issue.priority === "high" && <p>Высокий приоритет</p>}<IssueWorkflow issue={issue} /></details>
  {issue.mine && <><a href="#issue-chat" className={styles.chatAction}><Icon name="messages" />Связаться с УК</a><IssueConversation key={issue.id} issueId={issue.id} /></>}
 </>;
}
