# Правки листов 01–04

Инструмент: встроенный image_gen.imagegen, режим редактирования исходных PNG с готовым логотипом exec-88adf04b-267c-47cd-9ae8-f2d9e705b537.png как референсом вставки. Для плана использован старый прототип 161048.

Четыре отдельных PNG, по три экрана на каждом. Исходные файлы 01–10 оставлены без изменений. В архиве domoved-updated-01-04.zip только четыре обновлённых PNG. React-код не изменялся; коммиты не создавались.

Проверка: изображения просмотрены полностью, проверены подписи плана, нужные удаления, нижние кнопки и навигация. Контрольные суммы всех десяти исходных PNG совпадают с зафиксированными до работы.

Ограничение растрового редактирования ImageGen: инструмент может слегка перерисовывать мелкие элементы и начертание логотипа; побайтовая вставка оригинального логотипа и неизменность остальных пикселей не гарантируются.

## Точные запросы

### 01

```text
Use case: precise-object-edit. Edit the FIRST reference image ONLY: 01-home-issues-sheet.png. The second image is the approved READY-MADE transparent dark Домовед wordmark, a supporting insert, NOT an edit target. Produce ONE updated landscape image with the SAME THREE complete screens, canvas aspect ratio 4:3, same arrangement, same full-height panels and captions, no cropping. This is surgical correction of a selected design, NEVER a redesign. Preserve all unmentioned pixels/layout/colors/type/icon style/content as closely as possible. Main buttons remain dark teal. No red plus icons. Crisp readable Russian.

COMMON: Replace EVERY old wordmark using the supplied approved wordmark image as a ready-made graphic, preserving exact custom letterforms, red hat, aspect ratio, no retyping/redrawing. Center each wordmark horizontally relative to its screen. Center the sheet wordmark relative to the bottom sheet itself. Remove all moon/theme buttons with their icon, border and container from all three headers including dimmed background. Leave back/close controls where present. Bottom tabs left-to-right Дом → ЖКХ → Обращения → Камеры → Ещё; Обращения third/center.

LEFT HOME: Remove the entire watercolor house illustration AND ALL accompanying vegetation, trees, watercolor foliage/haze from the upper area. Restore plain icy screen background in that area, leave it empty, add NO replacement art. Keep the address plaque г. Казань / Солнечная, 3, apartment line, house-health 85/100, 5 active issues, service tiles ЖКХ and Сообщения, the issue list unchanged. In Сообщения tile change only 'Переписки с соседями' to '3 новых сообщения', readable compact two-line hierarchy below title. Remove ONLY the home screen bottom 'Создать обращение' pill including its white plus and shadow; leave background clear above intact bottom navigation.

CENTER ISSUES: Replace elevator and rubbish photographic thumbnails with crisp OUTLINE category icons in the exact style of the existing bulb and door tiles. First elevator icon in pale blue tile; second rubbish bin in pale blue tile. Keep bulb and door icons, all issue titles/location/category/status/date, list tabs counts, search and filters unchanged. Preserve the dark teal 'Создать обращение' button and its WHITE plus on this center screen.

RIGHT BOTTOM SHEET: Preserve all its content exactly: grab handle, close X, Создать обращение / Расскажите, что случилось. / Где возникла проблема?, Подъезд, Двор, Квартира choices and icons, location suggestion and Изменить, Продолжить button, dimensions and position. Only apply common logo/header edits. Dimmed underlying header also has centered logo and no moon.
Keep all bottom buttons and navigation fully visible, never crop. Preserve the original compact typography and margins. Output ONLY the single revised three-screen board.
```

### 02

```text
This is a precise-object-edit of the FIRST reference only, a selected finished Russian app UI board, not a redesign. Output ONE revised landscape 4:3 board with SAME THREE full-height screens side by side, same margins, pale icy backdrop, captions, compact Onest-like typography, screen dimensions and all original UI. Preserve unmentioned content and layout extremely closely. Second reference is the approved ready-made transparent dark Домовед logo insert, NOT a target to edit. Replace old logos using that ready-made graphic, exact custom letterforms, proportions and red hat, no retyping, no redesign, horizontally centered within EVERY screen; if a bottom sheet present center its logo relative to the sheet. Remove all theme toggle buttons including moon icons, outlines and containers from every header including dimmed backgrounds. Keep back and close controls. Existing bottom navigation remains Дом → ЖКХ → Обращения → Камеры → Ещё with Обращения third/center. Dark teal main buttons retain current colors. No red plus icons. Never crop any screen, bottom button, footer or tab. Readable exact Cyrillic text. 
EDIT 02-create-place-category-description.png, the first reference. Third reference is the old prototype floor plan for STRUCTURE ONLY, not a style reference: adopt its center spine shared-zone layout while retaining the first reference's polished current style.

ALL THREE SCREENS: completely remove repeated large heading 'Новое обращение' beneath the logos, leave calm spacing there. Keep the centered ready-made logos, back arrow and close X in each header, all four-step progress indicators and specific step headings. Do not add navigation. Keep all forms and footers entirely within screen.

LEFT 'Шаг 1. Место': Keep title Где возникла проблема?, dropdowns Подъезд=1, Этаж=2, Помещение=Лифт, selected address string Подъезд 1 · Этаж 2 · Лифт, Назад and Продолжить footer buttons. Rework ONLY floor-plan inside its existing area: four numbered apartment blocks (Квартира 1 upper-left, Квартира 2 upper-right, Квартира 3 lower-left, Квартира 4 lower-right), with a distinct CENTRAL VERTICAL COLUMN between apartments subdivided top-to-bottom into FIVE SHARED ZONES/layout: 'Лифт' at top, then 'Лестница', then a separate visibly larger 'Холл' rectangle, then 'Техническое помещение' at bottom of center spine, then a FULL-WIDTH bottom 'Входная группа'. These are FIVE labels counting entrance: Лифт, Лестница, Холл, Техническое помещение, Входная группа. Make all readable using short 2-3-line wrapping for technical room. The hall MUST be a separate visible room labeled exactly 'Холл', not blank passage. Elevator selected with clear dark teal border, pale teal fill and elevator outline icon. Other rooms unselected with thin blue-gray borders and small coherent line icons. Keep logical central spine and doors. As needed slightly widen center column and adjust room proportions inside original floor-plan bounds so labels legible, but do not change overall screen.

CENTER 'Шаг 2. Категория': Apart from removing 'Новое обращение' and approved logo replacement, keep everything exactly as original: steps, Что случилось?, location strip, 2-column category grid and selected Лифт, nine categories, Назад / Продолжить.

RIGHT 'Шаг 3. Описание': Apart from removing 'Новое обращение' and approved logo replacement, keep exact original fields, problem title and description, location strip, photo thumbnail, blue add-photo plus tile, photo count, Сохранить черновик, Назад / Проверить. Do not remove photographs here. All lower actions fully visible.
Output only the updated board.
```

### 03

```text
This is a precise-object-edit of the FIRST reference only, a selected finished Russian app UI board, not a redesign. Output ONE revised landscape 4:3 board with SAME THREE full-height screens side by side, same margins, pale icy backdrop, captions, compact Onest-like typography, screen dimensions and all original UI. Preserve unmentioned content and layout extremely closely. Second reference is the approved ready-made transparent dark Домовед logo insert, NOT a target to edit. Replace old logos using that ready-made graphic, exact custom letterforms, proportions and red hat, no retyping, no redesign, horizontally centered within EVERY screen; if a bottom sheet present center its logo relative to the sheet. Remove all theme toggle buttons including moon icons, outlines and containers from every header including dimmed backgrounds. Keep back and close controls. Existing bottom navigation remains Дом → ЖКХ → Обращения → Камеры → Ещё with Обращения third/center. Dark teal main buttons retain current colors. No red plus icons. Never crop any screen, bottom button, footer or tab. Readable exact Cyrillic text. 
TARGET: 03-review-success-details.png. ONLY change the old wordmark in the top header of each of three screens to the supplied approved ready-made logo and reposition each exactly horizontally centered in its own screen (not the canvas). This board has no moon controls, so do not invent or remove any other controls. ALL OTHER PIXELS AND CONTENT MUST BE PRESERVED AS EXACTLY AS POSSIBLE. Keep original scale/margins and no new content, no theme controls, no altered card hierarchy.

LEFT: Keep Проверьте обращение and subtitle, four-step completed progress, all summary rows Место / Категория / Заголовок / Описание and values, all four Изменить links, elevator PHOTOGRAPH beneath description, attachment caption, Назад and Отправить обращение buttons unchanged.

CENTER: Keep success check artwork, Обращение отправлено, number №128, УК получила ваше сообщение, summary elevator photo and Новое badge, accepted/assignment/resolution three-step timeline with full text and dates, and BOTH buttons. Primary button exact 'Открыть обращение'; secondary 'Вернуться домой'.

RIGHT: Keep exact original layout and order: back Обращения, Не работает лифт title, В работе status, №128 · 18 октября 2026, Лифт and location, then Описание and its 2-line text FIRST, then wide elevator PHOTOGRAPH directly BELOW description in same card. DO NOT move, omit or replace photo, DO NOT swap description/photo. Keep full История обращения timeline with all 3 items, all original text/date detail, Связаться с УК button and complete bottom tabs Дом / ЖКХ / Обращения / Камеры / Ещё with center selected. No cropping of lower actions or timeline.

This is a trivial header-only change. Make no changes to photo content, body UI, colors, icons, copy, or positions outside header-logo area. Output only one updated three-screen board.
```

### 04

```text
This is a precise-object-edit of the FIRST reference only, a selected finished Russian app UI board, not a redesign. Output ONE revised landscape 4:3 board with SAME THREE full-height screens side by side, same margins, pale icy backdrop, captions, compact Onest-like typography, screen dimensions and all original UI. Preserve unmentioned content and layout extremely closely. Second reference is the approved ready-made transparent dark Домовед logo insert, NOT a target to edit. Replace old logos using that ready-made graphic, exact custom letterforms, proportions and red hat, no retyping, no redesign, horizontally centered within EVERY screen; if a bottom sheet present center its logo relative to the sheet. Remove all theme toggle buttons including moon icons, outlines and containers from every header including dimmed backgrounds. Keep back and close controls. Existing bottom navigation remains Дом → ЖКХ → Обращения → Камеры → Ещё with Обращения third/center. Dark teal main buttons retain current colors. No red plus icons. Never crop any screen, bottom button, footer or tab. Readable exact Cyrillic text. 
TARGET: 04-utilities-meters-payment.png. Preserve the selected board EXACTLY apart from these explicitly named edits.

COMMON logo/header edits: Center approved ready-made supplied dark wordmark in top of LEFT, CENTER and dimmed RIGHT background screen; center same wordmark in RIGHT bottom sheet relative to sheet itself. Remove moon theme-toggle icon/button/outline in all three top headers, restore screen background.

LEFT BILL: In the four itemized service rows REMOVE ENTIRELY every icon and its pale icon container before service name. The four rows become simply left-aligned service name plus right-aligned amount, with consistent 18px inner padding and unchanged subtle horizontal dividers. Text EXACTLY:
Содержание жилья     1 650,00 ₽
Отопление            1 520,00 ₽
Водоснабжение          680,50 ₽
Электроэнергия          661,00 ₽
Leave ALL other content intact: ЖКХ title, address, apartment, tabs, Сентябрь 2026, unpaid badge, invoice number, total 4 511,50 ₽, due date, Оплатить квитанцию, Скачать квитанцию with download icon, apartment information card and its building icon, account LS-000265, correct complete bottom nav. Removing icons applies ONLY four service rows, not any other icons.

CENTER METERS: Completely remove the lower informational text 'Данные проверены. Показания будут переданы в управляющую компанию' AND its green round checkmark AND any associated container. There must be NO text and NO green checkmark remaining beneath electricity meter. Preserve all three meter cards and their icons, labels, inputs, values and units, as well as upper blue informational deadline notice and calendar icon. Preserve 'Передать показания' dark teal button and bottom navigation. After deleting green-check info, put a clean ordinary 18-24px vertical gap between the last meter card and 'Передать показания' button (move button UP modestly as needed), leave calm blank spacing before bottom nav rather than replacing the message with anything else. Do not remove buttons or meters.

RIGHT PAYMENT SHEET: Apply ONLY common logo/header edits. Keep grab handle, close X, Оплата квитанции, Сентябрь 2026 and invoice number, apartment/location card and its icon, both payment methods СБП selected / Банковская карта with icons/radio, sum 4 511,50 ₽, commission 0 ₽, dark teal Перейти к оплате, lock icon and Оплата на защищённой странице. Do NOT remove service icons from payment-methods or apartment card. Preserve sheet height, position and dimming.

No other changes. Output only one revised three-screen board with all lower buttons/navigation uncut.
```

