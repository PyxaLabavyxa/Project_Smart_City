// Local fixture scores from the prototype, not telemetry or a backend DTO.
export const demoHealth = {
  score: 82,
  condition: "Дом в хорошем состоянии",
  summary: "Водоснабжение и лифты требуют внимания.",
  systems: [
    { id: "water", name: "Водоснабжение", score: 68, note: "Повторные протечки и увеличенное время устранения." },
    { id: "heating", name: "Отопление", score: 96, note: "Подготовка к отопительному сезону." },
    { id: "electricity", name: "Электричество", score: 91, note: "Контроль освещения общих зон." },
    { id: "elevators", name: "Лифты", score: 74, note: "Проверка работы дверей и механизмов." },
    { id: "entrances", name: "Подъезды", score: 87, note: "Контроль дверей и общих помещений." },
    { id: "territory", name: "Территория", score: 90, note: "Уборка и содержание двора." },
    { id: "security", name: "Безопасность", score: 86, note: "Контроль доступа и общих зон." },
  ],
} as const;
