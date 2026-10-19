export type NotificationPreferences = {
  personal_messages: boolean;
  issue_messages: boolean;
  issue_statuses: boolean;
  announcements: boolean;
};

export function parseNotificationPreferences(value: unknown): NotificationPreferences {
  if (!value || typeof value !== "object") throw new Error("Не удалось прочитать настройки уведомлений");
  const fields = ["personal_messages", "issue_messages", "issue_statuses", "announcements"] as const;
  for (const field of fields) {
    if (!(field in value) || typeof value[field as keyof typeof value] !== "boolean") throw new Error("Не удалось прочитать настройки уведомлений");
  }
  return value as NotificationPreferences;
}
