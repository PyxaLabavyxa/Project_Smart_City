const paths: Record<string, string> = {
  "Электричество": "m13 2-9 12h7l-1 8 10-13h-8Z",
  "Подъезд": "M4 21h16M6 21V4l12-2v19M6 4h12M14 12h.01",
  "Водоснабжение": "M12 3c-2 4-6 7-6 11a6 6 0 0 0 12 0c0-4-4-7-6-11ZM9 14a3 3 0 0 0 3 3",
  "Лифт": "M7 3v18M3 7l4-4 4 4M17 21V3m-4 14 4 4 4-4",
};

export function IssueCategoryIcon({ category }: { category: string }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[category] ?? "M5 4h14v16H5ZM9 8h6M9 12h6M9 16h3"} />
  </svg>;
}
