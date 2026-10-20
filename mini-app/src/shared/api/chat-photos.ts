export type ChatPhoto = { id: number; url: string };
export type ChatDraftPhoto = { id: string; file: File };

export function parseChatPhotos(value: unknown): ChatPhoto[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Некорректные фотографии сообщения");
  return value.map(photo => {
    if (!photo || typeof photo !== "object" || !Number.isSafeInteger(photo.id) || photo.id < 1
      || typeof photo.url !== "string" || !/^\/api\/v1\/chat-photos\/[1-9]\d*$/.test(photo.url)) {
      throw new Error("Некорректная фотография сообщения");
    }
    return { id: photo.id, url: photo.url };
  });
}

export function chatBody(data: object, photos: readonly ChatDraftPhoto[]): object | FormData {
  if (!photos.length) return data;
  const form = new FormData();
  form.set("data", JSON.stringify(data));
  photos.forEach(photo => form.append("photos", photo.file));
  return form;
}
