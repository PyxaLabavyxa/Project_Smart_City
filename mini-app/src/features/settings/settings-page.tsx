"use client";

import { useCallback, useState } from "react";
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
  { value: "light", title: "Светлая", icon: "sun" },
  { value: "dark", title: "Тёмная", icon: "moon" },
  { value: "system", title: "Системная", icon: "device" },
] as const;
const notifications = [
  { key: "personal_messages", title: "Личные сообщения", text: "Новые сообщения от соседей" },
  { key: "issue_messages", title: "Ответы по обращениям", text: "Новые сообщения от управляющей компании" },
  { key: "issue_statuses", title: "Статусы обращений", text: "Начало работ, решение или отклонение обращения" },
  { key: "announcements", title: "Объявления дома", text: "Рассылка новостей УК пока не подключена. Ваш выбор сохранится." },
] as const;

export function SettingsPage() {
  const [tab, setTab] = useState<"appearance" | "notifications">("appearance");
  const theme = useThemePreference();
  const [themeError, setThemeError] = useState("");
  function chooseTheme(value: ThemePreference) {
    try { setTheme(value); setThemeError(""); }
    catch { setThemeError("Не удалось сохранить тему. Разрешите хранение данных для этого сайта."); }
  }
  return <SectionPage title="Настройки" backHref={null}>
    <div className={styles.tabs} role="tablist" aria-label="Разделы настроек">
      <button id="appearance-tab" role="tab" aria-selected={tab === "appearance"} aria-controls="settings-panel" tabIndex={tab === "appearance" ? 0 : -1} onClick={() => setTab("appearance")} onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { setTab("notifications"); document.getElementById("notifications-tab")?.focus(); } }}>Оформление</button>
      <button id="notifications-tab" role="tab" aria-selected={tab === "notifications"} aria-controls="settings-panel" tabIndex={tab === "notifications" ? 0 : -1} onClick={() => setTab("notifications")} onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { setTab("appearance"); document.getElementById("appearance-tab")?.focus(); } }}>Уведомления</button>
    </div>
    <div id="settings-panel" role="tabpanel" aria-labelledby={tab === "appearance" ? "appearance-tab" : "notifications-tab"}>
      {tab === "appearance" ? <>
        <h2 className={styles.heading}>Тема приложения</h2>
        <fieldset className={styles.themes}><legend className={styles.srOnly}>Выберите тему</legend>{themes.map(item => <label key={item.value} className={styles.theme}>
          <input type="radio" name="theme" value={item.value} checked={theme === item.value} onChange={() => chooseTheme(item.value)} />
          <span className={styles.preview} data-theme-preview={item.value}><Icon name={item.icon} size={28} /></span><strong>{item.title}</strong>
        </label>)}</fieldset>
        <p className={styles.note}>Системная тема следует настройкам вашего устройства. Выбор сохраняется в этом браузере.</p>
        {themeError && <p role="alert" className={styles.error}>{themeError}</p>}
      </> : <NotificationSettings />}
    </div>
  </SectionPage>;
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
    <h2 className={styles.heading}>Уведомления в MAX</h2>
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
