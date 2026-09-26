// Local presentation fixtures based on the supplied prototype; not live house telemetry.
export const homeOverview = {
  score: 82,
  condition: "Всё под контролем",
  summary: "Водоснабжение и лифты требуют внимания. Следите за ходом работ в обращениях.",
  works: [
    { date: "2026-09-28", day: "28", title: "Проверка лифтов", time: "10:00–13:00", location: "оба подъезда", note: "Возможны короткие остановки." },
    { date: "2026-09-30", day: "30", title: "Подготовка к отоплению", time: "09:00–16:00", location: "весь дом", note: "" },
  ],
} as const;
