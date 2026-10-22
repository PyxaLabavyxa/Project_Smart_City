import { array, number, record, string } from "../../shared/api/parse.ts";

export function parseRegistration(value: unknown) {
  const data = record(value);
  if (typeof data.complete !== "boolean" || typeof data.test_mode !== "boolean") throw new Error("Некорректный статус регистрации");
  return {
    complete: data.complete, testMode: data.test_mode, name: string(data.name),
    status: data.status === null ? null : string(data.status),
    companies: array(data.companies, value => {
      const company = record(value);
      return { id: number(company.id), name: string(company.name), houses: array(company.houses, value => {
        const house = record(value);
        return {
          id: number(house.id), address: string(house.address), floors: number(house.floors), apartmentsCount: number(house.apartments_count),
          entrances: array(house.entrances, value => {
            const entrance = record(value);
            return { number: number(entrance.number), firstApartment: number(entrance.first_apartment), lastApartment: number(entrance.last_apartment), apartmentsCount: number(entrance.apartments_count) };
          }),
        };
      }) };
    }),
  };
}
export type Registration = ReturnType<typeof parseRegistration>;
