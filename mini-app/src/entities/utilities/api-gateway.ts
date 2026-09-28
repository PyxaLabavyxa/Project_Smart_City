import { endpoints, type ApiClient } from "@/shared/api/client";
import { array, decimal, number, record, string } from "@/shared/api/parse";
import type { UtilitiesGateway, UtilityAccount, Meter } from "./model";

function parseAccount(value: unknown): UtilityAccount | undefined {
  if (value === null) return undefined;
  const row = record(value);
  return {
    number: string(row.number), invoiceNumber: row.invoiceNumber === null ? "" : string(row.invoiceNumber),
    area: decimal(row.area), residents: number(row.residents), period: row.period === null ? "" : string(row.period),
    readingPeriod: string(row.readingPeriod), due: row.due === null ? "" : string(row.due),
    charges: array(row.charges, value => { const c = record(value); return { title: string(c.title), quantity: string(c.quantity), tariff: string(c.tariff), amount: number(c.amount) }; }),
    meters: array(row.meters, value => {
      const m = record(value);
      if (m.kind !== "cold" && m.kind !== "hot" && m.kind !== "electricity") throw new Error("Неизвестный тип счётчика");
      return { id: string(m.id), serial: string(m.serial), kind: m.kind, previous: decimal(m.previous), current: m.current === null ? undefined : decimal(m.current) } satisfies Meter;
    }),
  };
}
export function createUtilitiesGateway(api: ApiClient, apartment: number): UtilitiesGateway {
  let period: string | undefined;
  return {
    async loadAccount() {
      const account = parseAccount(await api(endpoints.utilities(apartment)));
      period = account?.readingPeriod;
      return account;
    },
    async saveReading(id, value) {
      if (!period) throw new Error("Обновите данные лицевого счёта");
      const account = parseAccount(await api(endpoints.readings(id), { body: { value: value.trim().replace(",", "."), period } }));
      if (!account) throw new Error("Лицевой счёт не найден");
      return account;
    },
  };
}
