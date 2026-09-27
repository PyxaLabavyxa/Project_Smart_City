const paths: Record<string, string> = {
  "Электричество": "m13 2-9 12h7l-1 8 10-13h-8Z",
  "Подъезд": "M4 21h16M6 21V4l12-2v19M6 4h12M14 12h.01",
  "Водоснабжение": "M12 3c-2 4-6 7-6 11a6 6 0 0 0 12 0c0-4-4-7-6-11ZM9 14a3 3 0 0 0 3 3",
  "Лифт": "M7 3v18M3 7l4-4 4 4M17 21V3m-4 14 4 4 4-4",
  "Отопление": "M4 8h16v11H4ZM8 8v11m4-11v11m4-11v11M6 3v2m6-2v2m6-2v2M2 12h2m16 3h2",
  "Двор": "M12 2 5 12h4l-5 6h16l-5-6h4ZM12 18v4",
  "Мусор": "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  "Безопасность": "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6ZM8 12l3 3 5-6",
  "Уборка": "m16 3-5 10M8 12l7 3-2 6H3l3-7ZM7 16l-2 5m6-4-1 4",
  "Другое": "M5 12h.01M12 12h.01M19 12h.01",
};

export function IssueCategoryIcon({ category }: { category: string }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[category] ?? "M5 4h14v16H5ZM9 8h6M9 12h6M9 16h3"} />
  </svg>;
}
