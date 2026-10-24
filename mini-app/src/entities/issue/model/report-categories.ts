import type { HouseLocation } from "@/entities/house";

export type ReportScope = "entrance" | "courtyard" | "apartment";
export type ReportCategory = { value: string; label: string };

const categories: Record<ReportScope, readonly ReportCategory[]> = {
  courtyard: [
    { value: "Двор", label: "Благоустройство" },
    { value: "Мусор", label: "Уборка и мусор" },
    { value: "Электричество", label: "Уличное освещение" },
    { value: "Водоснабжение", label: "Вода и ливнёвка" },
    { value: "Безопасность", label: "Безопасность" },
    { value: "Другое", label: "Другое" },
  ],
  entrance: [
    { value: "Лифт", label: "Лифт" },
    { value: "Электричество", label: "Освещение и электрика" },
    { value: "Подъезд", label: "Двери и общие зоны" },
    { value: "Мусор", label: "Уборка и мусор" },
    { value: "Водоснабжение", label: "Вода и протечки" },
    { value: "Отопление", label: "Отопление" },
    { value: "Безопасность", label: "Безопасность" },
    { value: "Другое", label: "Другое" },
  ],
  apartment: [
    { value: "Водоснабжение", label: "Вода и канализация" },
    { value: "Отопление", label: "Отопление" },
    { value: "Электричество", label: "Электричество" },
    { value: "Безопасность", label: "Безопасность" },
    { value: "Другое", label: "Другое" },
  ],
};

const commonAreaCategories = categories.entrance.filter(category => category.value !== "Лифт");
const categoriesByZone: Record<HouseLocation["zone"], readonly ReportCategory[]> = {
  corridor: commonAreaCategories,
  stairs: commonAreaCategories,
  entrance: commonAreaCategories,
  elevator: categories.entrance.filter(category => ["Лифт", "Электричество", "Мусор", "Безопасность", "Другое"].includes(category.value)),
  technical: categories.entrance,
  house: categories.courtyard,
  courtyard: categories.courtyard,
  parking: categories.courtyard,
  apartment: categories.apartment,
};

export function reportScope(place: Pick<HouseLocation, "zone">): ReportScope {
  if (place.zone === "apartment") return "apartment";
  return ["house", "courtyard", "parking"].includes(place.zone) ? "courtyard" : "entrance";
}

export function categoriesForPlace(place: Pick<HouseLocation, "zone">) {
  return categoriesByZone[place.zone];
}

export function reportCategoryLabel(place: Pick<HouseLocation, "zone"> | undefined, category: string) {
  return place ? categoriesForPlace(place).find(item => item.value === category)?.label ?? category : category;
}

export function reportVisibilityLabel(place: HouseLocation): string {
  switch (reportScope(place)) {
    case "apartment": return "Обращение увидите только вы и сотрудники вашей УК.";
    case "courtyard": return "Обращение увидят все жители дома и сотрудники вашей УК.";
    case "entrance": return `Обращение увидят жители подъезда №${place.entrance} и сотрудники вашей УК.`;
  }
}
