export type ManagementContact = {
  label: string;
  kind: "phone" | "email" | "address" | "website" | "schedule";
  value: string;
  note: string;
};

export type ManagementContacts = { companyName: string; items: ManagementContact[] };

export function contactInformation(items: readonly ManagementContact[]) {
  const remaining = [...items];
  const take = (kind: ManagementContact["kind"], match?: RegExp) => {
    const index = remaining.findIndex(item => item.kind === kind
      && (!match || match.test(item.label))
      && (kind !== "website" || contactHref(item)));
    return index === -1 ? undefined : remaining.splice(index, 1)[0];
  };
  // Match the primary fields in the staff form before collecting extra contacts.
  const dispatcher = take("phone", /диспетчер/i);
  const hours = take("schedule", /график|работ/i);
  const reception = take("schedule", /при[её]м/i);
  const emergency = take("phone", /авари|экстрен/i);
  const email = take("email");
  const website = take("website");
  const office = take("address");
  const primaryDispatcher = dispatcher ?? take("phone");
  return { dispatcher: primaryDispatcher, emergency, email, website, office, hours, reception, additional: remaining };
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
