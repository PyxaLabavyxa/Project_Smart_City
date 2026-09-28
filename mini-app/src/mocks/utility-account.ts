import { applyReading, type UtilityAccount, type UtilitiesGateway } from "@/entities/utilities/model";

export function createMockUtilitiesGateway(): UtilitiesGateway {
  let account = createMockUtilityAccount();
  return {
    async loadAccount() { return structuredClone(account); },
    async saveReading(meterId, value) {
      account = applyReading(account, meterId, value);
      return structuredClone(account);
    },
  };
}

// Illustrative charges and tariffs, not a provider's bill or regional tariff schedule.
export function createMockUtilityAccount(): UtilityAccount {
  return {
    number: "000071001", invoiceNumber: "09-2026-071", area: 54, residents: 2,
    period: "Сентябрь 2026", readingPeriod: "октябрь", due: "15 октября 2026",
    charges: [
      { title: "Содержание жилья", quantity: "54 м²", tariff: "32,50 ₽/м²", amount: 175500 },
      { title: "Отопление", quantity: "0,82 Гкал", tariff: "2 650 ₽/Гкал", amount: 217300 },
      { title: "Холодное водоснабжение", quantity: "4 м³", tariff: "48,20 ₽/м³", amount: 19280 },
      { title: "Горячее водоснабжение", quantity: "3 м³", tariff: "225 ₽/м³", amount: 67500 },
      { title: "Водоотведение", quantity: "7 м³", tariff: "38,50 ₽/м³", amount: 26950 },
      { title: "Электроэнергия", quantity: "142 кВт·ч", tariff: "6,80 ₽/кВт·ч", amount: 96560 },
      { title: "Обращение с ТКО", quantity: "2 человека", tariff: "145 ₽/чел.", amount: 29000 },
      { title: "Капитальный ремонт", quantity: "54 м²", tariff: "15 ₽/м²", amount: 81000 },
    ],
    meters: [
      { id: "cold-1", kind: "cold", serial: "ХВ-104821", previous: 124.6 },
      { id: "hot-1", kind: "hot", serial: "ГВ-104822", previous: 86.2 },
      { id: "electricity-1", kind: "electricity", serial: "ЭЛ-208315", previous: 3542 },
    ],
  };
}
