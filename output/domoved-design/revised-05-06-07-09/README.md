# Домовед — правки 05, 06, 07, 09

- 05-cameras-light-detail-dark.png — 3 экрана. Правый тёмный экран сохранён попиксельно.
- 06-more-contacts-messages.png — 2 экрана: Ещё и Контакты УК. Без пустой третьей колонки.
- 07-house-floor-information.png — 3 экрана: дом, план этажа, информация о доме.
- 09-health-onboarding-guide.png — 1 экран: Здоровье дома. Без пустых колонок.

Готовые логотипы и значок вставлены напрямую из исходных PNG exec-88adf04b… и exec-763d35df…, с сохранением пропорций и альфа-канала при масштабировании. Файлов zag… в доступных исходниках не найдено. Белый вариант exec-a7f467a8… не понадобился: тёмный экран 05 оставлен без изменений.

Изменения содержимого 05 и 07 выполнены встроенным image_gen.imagegen, затем перенесены только нужные области в исходные листы. Заголовки и фирменный блок собраны напрямую из готовых изображений; 06 и 09 сохранены из оригинальных листов с удалением лишних колонок. Параметры сборки: working/Compose.cs. Все исходные листы 01–10 сохранены без изменения. Коммиты не создавались.

Визуально проверены все четыре итоговых PNG: целые экраны, нижняя навигация, отсутствие удалённых карточек и надписей, пять подписанных общих зон плана. Проверка protected-column в 05 и основного содержимого 09: 0 изменённых пикселей.

## Запросы ImageGen

### 05

```text
Use case: precise-object-edit. Edit the supplied finished Russian Домовед mobile UI board ONLY where explicitly specified. Output the SAME 1448x1086 landscape 4:3 canvas, SAME THREE screens and positions, same icy white background, navy/teal colors, original font, rounded cards, photos, sizes, gutters and captions. NOT a redesign. Pixel fidelity to original is critical.
LEFT light camera-list screen: completely UNCHANGED, preserve both full photo cards, text and navigation.
RIGHT dark camera-list screen: absolutely UNCHANGED including old left-aligned white logo and SUN theme toggle with outline. EXCEPTION to any global design conventions: do NOT modify its header, content, photos, UI, spacing, colors or navigation in ANY way.
CENTER camera-view screen ONLY:
1. Replace secondary outline 'Развернуть' button with a matching secondary OUTLINE button labeled exactly 'Сообщить о проблеме'. Keep same width, height, navy/slate text/border and rounded corners. Remove expand icon; use a small consistent outline message icon if necessary.
2. Preserve dark teal primary 'Обновить кадр' button with refresh icon.
3. COMPLETELY remove the entire pale information banner containing 'Камера показывает общую зону подъезда' including circle-i icon, text and blue container.
4. COMPLETELY remove 'Другие камеры' heading AND other-camera card 'Подъезд 2' including thumbnail, subtitle, chevron and container.
5. Leave a calm clean empty area of existing icy screen background below the two buttons and above the original navigation. NO new content/cards, no placeholders.
Keep original center header logo and back Камеры, title Подъезд 1, location Солнечная, 3 · Входная зона, LARGE ORIGINAL camera photograph with EXACT original image crop, available badge Доступна, update timestamp Обновлено 18 октября 16:20, and bottom tabs. Header-logo correction will be applied separately; do not redesign logos. Preserve all bottom nav in all screens, left to right Дом / ЖКХ / Обращения / Камеры / Ещё (Обращения center).
All three screens and bottom navigation fully visible, no cropping. Only requested center-screen edits.
```

### 07

```text
Use case: precise-object-edit. FIRST IMAGE IS EDIT TARGET: finished 07-house-floor-information.png, three complete Russian Домовед screens. Second image old house prototype is reference for building architecture ONLY; third is old floor-plan reference for room layout ONLY. Keep target's exact 1448x1086 canvas, three panels at same positions, selected pale icy white/navy-teal style, typeface, cards, button colors, margins and bottom navigation. NOT a redesign. Preserve all unmentioned content as precisely as possible. Keep existing logos/headers for now; actual approved PNG logos will be inserted separately.
LEFT 'Ваш дом': Preserve back Ещё, title, Солнечная, 3 · 5 этажей · 40 квартир, floor selector five stacked numbers 5 4 3 2 1 with 1 selected, entrance/floor dropdowns 1, floor summary, Открыть план этажа button, Работы в доме card, bottom nav. Change ONLY the building illustration to closely resemble the simple old five-storey facade in second reference: rectangular modest apartment block, FIVE visible horizontal storeys total INCLUDING ground floor, flat roof, regular vertical grid of blue windows, central ground-level entrance, four windows per upper level similar old prototype, softly blue shaded facade. Retain current refined watercolor/outline presentation and restrained surrounding blue/green landscaping. Building must clearly have exactly FIVE floors, not 4 or 6. Fit within original illustration area without changing other UI.
CENTER 'План этажа': Keep heading/back План дома, entrance and floor dropdowns (1/1), full apartment search label/input/button Найти, bottom navigation. Clean/rebuild ONLY floor-plan within its existing rectangular bounds (approx x530..918,y425..793) with crisp readable walls and labels, no random marks or overlapping symbols. Four apartments with clearly readable numbers and labels: upper left '1 / Квартира', upper right '2 / Квартира', lower left '3 / Квартира' selected pale teal/dark teal outline, lower right '4 / Квартира'. NO 'нет жителей' text ANYWHERE. Between apartments a clearly visible vertical CENTRAL SPINE with FOUR separate labeled rectangles top to bottom: 'Лифт' with elevator outline icon; 'Лестница' with coherent stairs line icon; 'Холл' as a separate visible room; 'Техническое помещение' in 2-3 readable lines. Full-width separate bottom room 'Входная группа' with door icon. These FIVE common areas must be all distinct and all labeled. Use enough central-column width for text; no labels overlap walls. Keep logical door connections. Below plan retain small line Квартиры 1–4 · выбран 1 этаж. COMPLETELY REMOVE the entire 'Квартира 3' card beneath that line, including title, Нет жителей, Написать сообщение button/icon, white container. Leave existing screen background with calm spacing above bottom nav, no replacement card.
RIGHT 'Информация о доме': Remove ONLY final characteristics row 'Тип дома — Многоквартирный' AND its left building icon. Keep 4 other rows exactly: Этажей 5, Подъездов 2, Квартир 40, Год постройки 2010, with their icons and dividers. Remove surplus whitespace at bottom of card naturally, retain document and contacts card layout. Preserve address card, both documents with filenames/sizes and download icons, Управляющая компания / Контакты card and bottom nav. Change nothing else.
Every bottom nav left-to-right Дом / ЖКХ / Обращения / Камеры / Ещё, Обращения THIRD/CENTER. No red plus, no new features, no decoration. Entire screens and bottom navigation visible uncropped. Output only single updated three-screen board.
```

