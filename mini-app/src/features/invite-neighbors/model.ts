import { number, record, string } from "@/shared/api/parse";

export function parseInvitation(value: unknown, houseId: string) {
  const data = record(value);
  const id = number(data.house_id);
  if (String(id) !== houseId) throw new Error("Дом изменился. Откройте приглашение заново.");
  const url = new URL(string(data.url));
  if (url.protocol !== "https:" || url.hostname !== "max.ru" || url.username || url.password || url.port || url.hash || url.searchParams.get("startapp") !== `home_house_${id}`) throw new Error("Не удалось получить ссылку для этого дома.");
  const file = (key: string, name: string) => {
    const path = string(data[key]);
    if (path !== `/invitations/houses/${id}/${name}`) throw new Error("Не удалось получить приглашение для этого дома.");
    return path;
  };
  return { address: string(data.address), url: url.href, qrPath: file("qr_path", "qr.png"), posterPath: file("poster_path", "poster.png"), pdfPath: file("pdf_path", "poster.pdf") };
}
