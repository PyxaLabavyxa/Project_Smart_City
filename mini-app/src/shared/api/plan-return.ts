export function planReturn(value: string | string[] | undefined): { href: string; label: string } {
  if (typeof value === "string" && /^\/messages\/[1-9]\d*(?:\?from=[1-9]\d*)?$/.test(value)) {
    const id = Number(value.slice("/messages/".length).split("?")[0]);
    if (Number.isSafeInteger(id)) return { href: value, label: `В чат с квартирой ${id}` };
  }
  return { href: "/house", label: "Ваш дом" };
}
