"use client";
import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "./icon";
import { BrandWordmark } from "./brand-mark";
import styles from "./chat-screen.module.css";

export function ChatScreen({ title, subtitle, avatar, backHref, backLabel, action, inbox = false, children }: {
  title: string; subtitle?: string; avatar?: ReactNode; backHref: string; backLabel: string;
  action?: ReactNode; inbox?: boolean; children: ReactNode;
}) {
  const page = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      page.current?.style.setProperty("--chat-height", `${viewport?.height ?? window.innerHeight}px`);
      page.current?.style.setProperty("--chat-top", `${viewport?.offsetTop ?? 0}px`);
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <div ref={page} className={styles.page} data-chat-screen data-inbox={inbox || undefined}>
    {inbox && <Link href="/" className={styles.inboxBrand} aria-label="Домовед — главная"><BrandWordmark /></Link>}
    <header className={styles.header}>
      <Link href={backHref} className={styles.back} aria-label={backLabel}><Icon name="back" size={24} /></Link>
      {avatar !== undefined && <span className={styles.avatar} aria-hidden="true">{avatar}</span>}
      <div className={styles.recipient}><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      {action}
    </header>
    {children}
  </div>;
}
