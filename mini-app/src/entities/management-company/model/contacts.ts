export type ManagementContact = {
  label: string;
  kind: "phone" | "email" | "address" | "website" | "schedule";
  value: string;
  note: string;
};

export type ManagementContacts = { companyName: string; items: ManagementContact[] };

export function contactInformation(items: readonly ManagementContact[]) {
  const emergency = items.find(item => item.kind === "phone" && /авари|экстрен/i.test(item.label));
  return {
    dispatcher: items.find(item => item.kind === "phone" && /диспетчер/i.test(item.label))
      ?? items.find(item => item.kind === "phone" && item !== emergency),
    emergency,
    email: items.find(item => item.kind === "email"),
    website: items.find(item => item.kind === "website" && contactHref(item)),
    office: items.find(item => item.kind === "address"),
    hours: items.find(item => item.kind === "schedule" && /график|работ/i.test(item.label)),
    reception: items.find(item => item.kind === "schedule" && /при[её]м/i.test(item.label)),
  };
}

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
