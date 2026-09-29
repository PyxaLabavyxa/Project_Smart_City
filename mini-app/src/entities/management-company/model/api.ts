import type { ApiClient } from "@/shared/api/client";
import { endpoints } from "@/shared/api/client";
import { array, record, string } from "@/shared/api/parse";
import type { ManagementContact, ManagementContacts } from "./contacts";

export async function getManagementContacts(api: ApiClient, house: string, signal: AbortSignal): Promise<ManagementContacts> {
  const response = record(await api(endpoints.contacts(house), { signal }));
  return {
    companyName: string(response.company_name),
    items: array(response.items, value => {
      const item = record(value);
      const kind = string(item.kind);
      if (kind !== "phone" && kind !== "email" && kind !== "address" && kind !== "website") throw new Error("Неизвестный тип контакта");
      return { kind, label: string(item.label), value: string(item.value), note: string(item.note) } satisfies ManagementContact;
    }),
  };
}
