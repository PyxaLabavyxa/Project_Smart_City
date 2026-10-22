// Stored destinations are never allowed to navigate outside the app.
export function notificationHref(href: string | null) {
  return href && /^\/(?:issues(?:\/[1-9]\d*(?:\/chat)?)?|messages(?:\/[1-9]\d*)?|cameras|more)?$/.test(href) ? href : null;
}
