"use client";
import { useLayoutEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BottomNavigation } from "./bottom-navigation";
import styles from "./shell.module.css";
import { BrandWordmark } from "@/shared/ui/brand-mark";
import { appIcon } from "@/shared/ui/artwork-assets";
import { Icon } from "@/shared/ui/icon";
import { ApartmentsReady } from "@/entities/house/ui/apartments-ready";
import { useHouseSelection } from "@/entities/house";
import { useIssues } from "@/entities/issue";
import { IssueCreated } from "@/features/report-issue/ui/issue-created";
import { NotificationBell } from "@/features/notifications/provider";
import { notificationReturn } from "@/features/notifications/notification-route";

function parentPage(path: string) {
  if (path.startsWith("/settings/")) return { href:"/settings", label:"Настройки" };
  if (path === "/plan") return { href:"/house", label:"Ваш дом" };
  if (path.startsWith("/issues/")) return { href:"/issues", label:"Обращения" };
  if (path.startsWith("/cameras/")) return { href:"/cameras", label:"Камеры" };
  if (["/invite", "/settings", "/health", "/messages", "/info", "/plan", "/house", "/contacts"].includes(path)) return { href:"/more", label:"Ещё" };
  return { href:"/", label:"На главную" };
}
export function ApplicationShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const { house } = useHouseSelection();
  const { issues, createdIssueId, dismissCreationNotice } = useIssues();
  const created = createdIssueId && (pathname === "/issues/new" || pathname === `/issues/${createdIssueId}`)
    ? issues.find(issue => issue.id === createdIssueId && issue.place?.houseId === house.id) : undefined;
  const confirmationId = created?.id;
  useLayoutEffect(() => {
    if (confirmationId) window.scrollTo({ top: 0, behavior: "instant" });
  }, [confirmationId]);
  const neighborChat = pathname === "/messages" || pathname.startsWith("/messages/") || /^\/issues\/[1-9]\d*\/chat\/?$/.test(pathname);
  const parent = pathname === "/notifications" ? notificationReturn(search.get("returnTo")) : parentPage(pathname);
  const inlineBack = pathname === "/contacts" || pathname.startsWith("/cameras/");
  const needsDirectory = ["/plan", "/house", "/info"].includes(pathname) || pathname.startsWith("/messages") || pathname.startsWith("/cameras");
  const immersive = neighborChat || (pathname === "/issues/new" && !created);
  return <div data-immersive={immersive || undefined} className={`${styles.app}${neighborChat ? ` ${styles.chatApp}` : ""}`}>
    <a className={styles.skip} href="#main">Перейти к содержимому</a>
    <header className={styles.header}>
      <Link href="/" prefetch={false} className={styles.brand} aria-label="Домовед — главная"><span className={styles.railIcon} style={{ backgroundImage: `url(${appIcon.src})` }} aria-hidden="true" /><BrandWordmark /></Link>
      <NotificationBell />
      {inlineBack && <Link href={parent.href} className={styles.headerBack} aria-label={`Назад: ${parent.label}`}><Icon name="back" /></Link>}
    </header>
    <main id="main" data-page-path={pathname} className={`${styles.main}${neighborChat ? ` ${styles.chatMain}` : ""}`} tabIndex={-1}>
{!neighborChat && !inlineBack && !["/", "/issues", "/utilities", "/cameras", "/more", "/issues/new", "/contacts", "/plan"].includes(pathname) && <Link href={parent.href} className={styles.back} aria-label={`Назад: ${parent.label}`}><Icon name="back" /><span>{parent.label}</span></Link>}
      <div key={created ? `created:${created.id}` : pathname} className={`${styles.pageTransition}${neighborChat ? ` ${styles.chatTransition}` : ""}`}>{created ? <IssueCreated issue={created} onOpen={() => { dismissCreationNotice(); window.scrollTo({ top: 0, behavior: "instant" }); }} /> : needsDirectory ? <ApartmentsReady>{children}</ApartmentsReady> : children}</div>
    </main>
    <BottomNavigation />
  </div>;
}
