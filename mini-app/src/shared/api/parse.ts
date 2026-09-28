export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Некорректный ответ сервера");
  return value as Record<string, unknown>;
}
export function string(value: unknown): string {
  if (typeof value !== "string") throw new Error("Некорректная строка в ответе сервера");
  return value;
}
export function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Некорректное число в ответе сервера");
  return value;
}
export function decimal(value: unknown): number {
  return number(typeof value === "string" && /^\d+(\.\d+)?$/.test(value) ? Number(value) : value);
}
export function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error("Некорректный список в ответе сервера");
  return value.map(parse);
}
