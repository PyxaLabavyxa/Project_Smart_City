// Stored destinations are never allowed to navigate outside the app.
export function notificationHref(href: string | null) {
  return href && /^\/(?:issues(?:\/[1-9]\d*(?:\/chat)?)?|messages(?:\/[1-9]\d*)?|cameras|more)?$/.test(href) ? href : null;
}

export function notificationReturn(value: string | null): { href: string; label: string } {
  if (value && value.length <= 4096 && !value.includes("\\") && !value.includes("#")
    && !Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    const path = value.split("?")[0];
    const sections: Record<string, string> = {
      "/": "На главную", "/utilities": "ЖКХ", "/issues": "Обращения",
      "/cameras": "Камеры", "/more": "Ещё", "/house": "Ваш дом",
      "/plan": "План этажа", "/messages": "Сообщения", "/health": "Здоровье дома",
      "/contacts": "Контакты УК", "/info": "О доме", "/invite": "Пригласить соседей",
      "/settings": "Настройки", "/settings/appearance": "Оформление",
      "/settings/notifications": "Настройки уведомлений",
      "/issues/new": "Создание обращения", "/cameras/new": "Добавление камеры",
    };
    const label = sections[path]
      ?? (/^\/issues\/[1-9]\d*(?:\/chat)?$/.test(path) ? "К обращению" : undefined)
      ?? (/^\/cameras\/[1-9]\d*(?:\/settings)?$/.test(path) ? "К камере" : undefined)
      ?? (/^\/messages\/[1-9]\d*$/.test(path) ? "К переписке" : undefined);
    if (label) return { href: value, label };
  }
  return { href: "/", label: "На главную" };
}

export function notificationInboxHref(pathname: string, search: string) {
  const origin = pathname === "/notifications"
    ? notificationReturn(new URLSearchParams(search).get("returnTo")).href
    : notificationReturn(pathname + (search ? `?${search}` : "")).href;
  return `/notifications?returnTo=${encodeURIComponent(origin)}`;
}
