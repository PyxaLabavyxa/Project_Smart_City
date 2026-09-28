export type MeterKind = "cold" | "hot" | "electricity";
export type Meter = { id: string; kind: MeterKind; serial: string; previous: number; current?: number };
export type Charge = { title: string; quantity: string; tariff: string; amount: number };
export type UtilityAccount = { number: string; invoiceNumber: string; area: number; residents: number; period: string; readingPeriod: string; due: string; charges: Charge[]; meters: Meter[] };
export interface UtilitiesGateway {
  loadAccount(): Promise<UtilityAccount | undefined>;
  saveReading(meterId: string, value: string): Promise<UtilityAccount>;
}
export const meterLabels: Record<MeterKind, string> = { cold: "Холодная вода", hot: "Горячая вода", electricity: "Электроэнергия" };
export const meterUnit = (kind: MeterKind) => kind === "electricity" ? "кВт·ч" : "м³";
export const money = (kopecks: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(kopecks / 100);
export const totalCharges = (charges: Charge[]) => charges.reduce((sum, charge) => sum + charge.amount, 0);
export function readingError(value: string, previous: number): string | undefined {
  if (!/^\d{1,7}([.,]\d{1,3})?$/.test(value.trim())) return "Введите положительное число, не более 3 знаков после запятой.";
  if (Number(value.replace(",", ".")) < previous) return `Показание не может быть меньше предыдущего: ${previous}.`;
}
export function applyReading(account: UtilityAccount, meterId: string, value: string): UtilityAccount {
  const meter = account.meters.find(item => item.id === meterId);
  if (!meter) throw new Error("Счётчик не найден в лицевом счёте квартиры.");
  const error = readingError(value, meter.previous);
  if (error) throw new Error(error);
  return { ...account, meters: account.meters.map(item => item.id === meterId ? { ...item, current: Number(value.trim().replace(",", ".")) } : item) };
}
