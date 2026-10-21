"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useApi } from "@/shared/api/context";
import { endpoints } from "@/shared/api/client";
import { useRemote } from "@/shared/api/use-remote";
import { SectionPage } from "@/shared/ui/navigation";
import { Icon } from "@/shared/ui/icon";
import { RefreshButton } from "@/shared/ui/refresh-button";
import { setTheme, useThemePreference, type ThemePreference } from "./theme";
import { parseNotificationPreferences, type NotificationPreferences } from "./notifications";
import styles from "./settings.module.css";

const themes = [
  { value: "light", title: "Светлая", text: "Светлый фон и тёмный текст", icon: "sun" },
  { value: "dark", title: "Тёмная", text: "Мягкие цвета на тёмном фоне", icon: "moon" },
  { value: "system", title: "Системная", text: "Как на вашем устройстве", icon: "device" },
] as const;
const notifications = [
  { key: "personal_messages", title: "Личные сообщения", text: "Новые сообщения от соседей" },
  { key: "issue_messages", title: "Ответы по обращениям", text: "Новые сообщения от управляющей компании" },
  { key: "issue_statuses", title: "Статусы обращений", text: "Начало работ, решение или отклонение обращения" },
  { key: "announcements", title: "Объявления дома", text: "Важные новости и объявления управляющей компании" },
] as const;

export function SettingsPage() {
  const theme = useThemePreference();
  const selected = themes.find(item => item.value === theme) ?? themes[2];
  return <SectionPage title="Настройки">
    <nav className={styles.sections} aria-label="Разделы настроек">
      <ul className={styles.sectionList}>
        <li><Link href="/settings/appearance" className={styles.sectionLink}>
          <span className={styles.sectionIcon}><Icon name={selected.icon} size={26} /></span>
          <span className={styles.sectionText}><strong>Оформление</strong><small>{selected.title} тема</small></span>
          <Icon name="arrow" size={18} />
        </Link></li>
        <li><Link href="/settings/notifications" className={styles.sectionLink}>
          <span className={styles.sectionIcon}><Icon name="bell" size={26} /></span>
          <span className={styles.sectionText}><strong>Уведомления</strong><small>О чём бот будет писать в MAX</small></span>
          <Icon name="arrow" size={18} />
        </Link></li>
      </ul>
    </nav>
  </SectionPage>;
}

export function AppearanceSettingsPage() {
  const theme = useThemePreference();
  const [themeError, setThemeError] = useState("");
  function chooseTheme(value: ThemePreference) {
    try { setTheme(value); setThemeError(""); }
    catch { setThemeError("Не удалось сохранить тему. Разрешите хранение данных для этого сайта."); }
  }
  return <SectionPage title="Оформление" description="Выберите удобную тему приложения.">
    <div className={styles.content}>
      <fieldset className={styles.themes}>
        <legend className={styles.srOnly}>Тема приложения</legend>
        {themes.map(item => <label key={item.value} className={styles.theme}>
          <span className={styles.preview} data-theme-preview={item.value}><Icon name={item.icon} size={25} /></span>
          <span className={styles.sectionText}><strong>{item.title}</strong><small>{item.text}</small></span>
          <input type="radio" name="theme" value={item.value} checked={theme === item.value} onChange={() => chooseTheme(item.value)} />
          <span className={styles.selection} aria-hidden="true"><Icon name="check" size={17} /></span>
        </label>)}
      </fieldset>
      <p className={styles.note}>Системная тема меняется вместе с настройками устройства. Ваш выбор сохранится на этом устройстве.</p>
      {themeError && <p role="alert" className={styles.error}>{themeError}</p>}
    </div>
  </SectionPage>;
}

export function NotificationSettingsPage() {
  return <SectionPage title="Уведомления"><div className={styles.content}><NotificationSettings /></div></SectionPage>;
}

function NotificationSettings() {
  const api = useApi();
  const load = useCallback(async (signal: AbortSignal) => parseNotificationPreferences(await api(endpoints.notifications, { signal })), [api]);
  const state = useRemote(load);
  const [saved, setSaved] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const current = saved ?? state.data;
  async function toggle(key: keyof NotificationPreferences) {
    if (!current || saving) return;
    setSaving(true); setError(""); setFeedback("");
    try {
      setSaved(parseNotificationPreferences(await api(endpoints.notifications, { body: { ...current, [key]: !current[key] } })));
      setFeedback("Настройки сохранены");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось сохранить настройки"); }
    finally { setSaving(false); }
  }
  return <>
    <p className={styles.note}>Выберите, о чём бот будет вам писать. Сами сообщения и история обращений останутся в приложении.</p>
    {state.loading && !current && <p role="status">Загрузка настроек…</p>}
    {state.error && !current && <div role="alert"><p>{state.error}</p><RefreshButton className={styles.retry} onRefresh={state.reload} loading={state.loading}>Повторить</RefreshButton></div>}
    {current && <div className={styles.notifications} aria-busy={saving}>{notifications.map(item => <label key={item.key} className={styles.notification}>
      <span><strong>{item.title}</strong><small id={`hint-${item.key}`}>{item.text}</small></span>
      <input type="checkbox" role="switch" aria-label={item.title} aria-describedby={`hint-${item.key}`} checked={current[item.key]} disabled={saving} onChange={() => void toggle(item.key)} />
    </label>)}</div>}
    <p className={styles.feedback} role="status">{saving ? "Сохранение…" : feedback}</p>
    {error && <p role="alert" className={styles.error}>{error} Попробуйте переключить ещё раз.</p>}
  </>;
}
