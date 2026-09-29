export type ManagementContact = {
  label: string;
  kind: "phone" | "email" | "address" | "website";
  value: string;
  note: string;
};

export type ManagementContacts = { companyName: string; items: ManagementContact[] };

export function contactHref(contact: ManagementContact): string | undefined {
  if (contact.kind === "phone") return `tel:${contact.value.replace(/[^+0-9]/g, "")}`;
  if (contact.kind === "email") return `mailto:${encodeURIComponent(contact.value)}`;
  if (contact.kind === "website") {
    try {
      const url = new URL(contact.value);
      if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return url.href;
    } catch { return undefined; }
  }
  return undefined;
}
