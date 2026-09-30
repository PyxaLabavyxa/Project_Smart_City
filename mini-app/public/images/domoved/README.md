# Иллюстрации Домоведа

Производные от предоставленных пользователем референсов. Подготовлены встроенным imagegen, затем уменьшены и упакованы в WebP с сохранением прозрачности.

- house-scene: дом, растения и маленький гном справа, без интерфейса.
- house-clean: тот же стиль дома и растений, без персонажей для остальных разделов.
- garden-footer: сад, скамейка и гном в кустах справа.
- gnome-guide: персонаж с красной шапкой и пальцем вверх-вправо; зеркальный вариант выполняется CSS.
- gnome-walk: полный персонаж в шаге вправо, для полоски загрузки.
- logo.svg: собственный простой контур дома и голубая дверь, без шапки.

Кадр entrance-1-1.png заменён исходным ГномикиКамера.jpg с конвертацией формата. Прочие камеры сохранены.

## High quality reference refinements

- `tutorial-point.webp`, `tutorial-rest.webp`, `tutorial-open.webp`: close-up character derived from the user’s 03-tutorial-gnome-hq.png; transparent head-and-hand poses.
- `window-gnome.webp`: head derived from 02-window-gnome-hq.png for native facade windows.
- `garden-hq.webp`: transparent garden derived from 04-more-footer-hq.png, shown below help/contacts at 77% opacity.
- `house-landscape.webp`: complete trees at the edges, empty centre for the interactive building.
- `house-night.webp`: night palette variant of the shared house illustration.

All seven assets use the built-in image_gen tool; exact final prompts and saved filenames are in [refinement-prompts.json](refinement-prompts.json). Alpha is preserved when resizing and converting to WebP.
