from app.storage.photos import MAX_PHOTOS, PhotoError


def collect_report(data: dict, message) -> dict:
    text = (message.body.text or "").strip()
    photos = list(data.get("photos", []))
    message_ids = list(data.get("report_message_ids", []))
    mid = str(message.body.mid)
    
    if mid in message_ids:
        return dict(data)

    for attachment in message.body.attachments or []:
        if attachment.type != "image":
            continue

        payload = attachment.payload
        url = getattr(payload, "url", None)

        if not url:
            raise PhotoError("Не удалось получить фото. Отправьте его повторно")
        
        photo_id = str(getattr(payload, "photo_id", None) or url)
        
        if not any(item["id"] == photo_id for item in photos):
            photos.append({"id": photo_id, "url": url})

    if len(photos) > MAX_PHOTOS:
        raise PhotoError(f"Можно прикрепить не больше {MAX_PHOTOS} фотографий")
    
    description = "\n".join(part for part in (data.get("description", ""), text) if part)
    
    if len(description) > 6000:
        raise PhotoError("Описание не должно превышать 6000 символов")
    
    if len(message_ids) >= 100:
        raise PhotoError("Слишком много сообщений в одном обращении")
    
    return {**data, "description": description, "photos": photos,
            "report_message_ids": [*message_ids, mid]}
