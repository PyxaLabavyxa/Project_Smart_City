# ДомПульс API

Общий Docker Compose для API, frontend, PostgreSQL и чатбота:
[DOCKER.md](../DOCKER.md). Сборка API выполняется с контекстом корня репозитория.

FastAPI, SQLAlchemy и PostgreSQL. Бот и API используют общие модели из
`app/database/models.py`; схему изменяют миграции `backend/migrations`.
Frontend обращается к API через native fetch. Подмена ответов локальными данными отключена.

## Локальный запуск

На текущем компьютере создан отдельный кластер PostgreSQL 17.9:
`backend/data/postgres`, порт `55432`, база и роль `dompulse`.
Пароль сгенерирован и записан только в исключённые из Git `.env` бота и API.
SQLite-файл и BOT_TOKEN в локальных настройках не найдены: база пустая,
токен своего бота нужно добавить в корневой `.env` и `backend/.env`.
Временные данные браузерной проверки в эту базу не переносились.

Запуск/остановка созданного кластера из корня репозитория:

```powershell
& 'C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe' -D backend/data/postgres -l backend/data/postgres.log -o '-h 127.0.0.1 -p 55432' -w start
& 'C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe' -D backend/data/postgres -w stop
```

Не запускайте кластер повторно, если он уже работает. Команды ниже с Copy-Item
предназначены для новой установки: существующие локальные `.env` не заменяйте.

Python 3.12+, проверено на Python 3.14 и PostgreSQL 17. Из `backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
$env:PYTHONPATH = ".."
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn smart_city_api.main:app --host 127.0.0.1 --port 8000 --loop smart_city_api.runtime:loop_factory
```

Перед миграциями заполните `DATABASE_URL` в `.env`. Пользователь и база PostgreSQL
должны существовать. На Linux используйте `.venv/bin/python` и `PYTHONPATH=..`.
`loop_factory` нужен Psycopg на Windows; он также работает на Linux.
Таблицы не создаются при запуске API или PostgreSQL-версии бота.

| Переменная | Назначение |
| --- | --- |
| DATABASE_URL | `postgresql+psycopg://user:password@host:5432/database` |
| BOT_TOKEN | Тот же токен, который используется чатботом |
| CORS_ORIGINS | JSON-массив точных origins frontend, без wildcard |
| MAX_AUTH_AGE_SECONDS | Допустимый возраст данных MAX; по умолчанию 3600 секунд |
| SESSION_COOKIE_SECURE | true для HTTPS; false только для локального HTTP |
| POSTGRES_PASSWORD | Пароль PostgreSQL для Compose |
| COMPOSE_DATABASE_URL | Строка подключения Compose с hostname `db` |

Пароль в URL должен быть URL-encoded. Боту задайте тот же `DATABASE_URL` в корневом
`.env`. Не копируйте токен в `NEXT_PUBLIC_*`. В production frontend и API желательно
размещать на одном сайте: браузеры могут блокировать сторонние cookie.

## Авторизация и доступ

`POST /api/v1/auth/max` проверяет подпись и возраст initData по
[официальному алгоритму MAX](https://dev.max.ru/docs/webapps/validation), находит
существующего пользователя бота и устанавливает HttpOnly-cookie на один час.
API повторно проверяет подпись cookie, пользователя и привязку квартиры.
Cookie-запросы на запись допускаются только с разрешённым Origin.
Для API-проверок также поддержан `Authorization: Bearer <подписанная initData>`.
Входа по произвольному user_id и открытой регистрации нет.
Истёкшая сессия требует повторного открытия приложения из MAX.

### Локальный вход без MAX

Для разработки на этом компьютере включён отдельный режим:
`LOCAL_LOGIN_ENABLED=true` и `LOCAL_SESSION_SECRET` в `backend/.env`,
`NEXT_PUBLIC_ENABLE_LOCAL_LOGIN=true` в `mini-app/.env.local`.
Секрет локальной сессии остаётся на сервере и не связан с токеном MAX.
Режим принимает только loopback-запросы с разрешённым Origin.

Из `backend`, с `PYTHONPATH=..`: `python -m scripts.seed_local` создаёт одного
проверочного жителя, тестовый дом и квартиру 71. Повторный запуск сохраняет данные.
Обращения и сообщения сохраняются в PostgreSQL обычными API-запросами.
В frontend виден переключатель «Локальный / MAX». Смена режима завершает сессию;
после перезагрузки при включённом frontend-флаге выбирается локальный режим.

Для отключения задайте оба флага `false` и перезапустите API и frontend
(production frontend нужно пересобрать). Уже выданные локальные cookie перестанут
приниматься сервером. На публичном сервере локальный режим должен быть выключен.

## Данные и маршруты

Фактический контракт: [openapi.json](openapi.json), `/docs` при запуске API.

- `/api/v1/me`: профиль, собственные квартиры и доступные дома.
- `/api/v1/houses/{id}/apartments`: реальные номера, подъезды и этажи.
- `/api/v1/houses/{id}/issues`: чтение и создание обращений.
- `/api/v1/issues/{id}`: карточка с местом и записанной историей.
- `/api/v1/apartments/{id}/messages`: чтение и отправка сообщений соседям дома.
- `/api/v1/apartments/{id}/utilities`: лицевой счёт, последняя квитанция и приборы.
- `/api/v1/meters/{id}/readings`: показание зарегистрированного прибора за открытый период.
- `/api/v1/houses/{id}/cameras`, `/api/v1/cameras/{id}/preview`: камеры и доступный HTTPS-кадр.
- `/api/v1/houses/{id}/works`: работы дома.
- `/health/live`, `/health/ready`: процесс и доступность соединения с БД.

У обращений, сообщений и квартир есть cursor-пагинация, размер страницы 1–100.
Создание обращения/сообщения использует UUID request_id: повтор с тем же содержимым
возвращает созданную запись, с другим — 409. Ограничение обеспечено и в БД.
Обращения внутри квартиры доступны её жильцам и автору; общие — жильцам дома.
Старые обращения без места считаются общедомовыми: перед переносом проверьте,
не содержат ли они приватные данные квартир. История прошлых изменений не выдумывается.

Квитанции и состав счётчиков вводятся обслуживающей системой, не жителем.
Показания не меняют начисления уже выставленной квитанции. Повтор одинакового
показания безопасен, изменение принятого показания возвращает 409.
Денежные суммы хранятся в копейках, показания — Numeric/Decimal.
Платежи, биллинг, подключение поставщиков, live-видеопотоки и доставка уведомлений
не реализованы. Пустые таблицы дают пустые состояния, а не условные записи.

## Перенос существующей SQLite

Остановите запись бота на время переноса и сделайте резервную копию SQLite
вместе с её WAL/SHM при наличии. Подготовьте пустую PostgreSQL и выполните миграции.

```powershell
$env:PYTHONPATH = ".."
.\.venv\Scripts\python.exe -m scripts.import_sqlite C:/absolute/path/smart_city.db
```

Скрипт читает SQLite в режиме read-only, переносит users, houses, apartments,
user_apartments, issues и issue_photos одной транзакцией, сохраняя ID и enum.
В непустую БД импорт запрещён. Последовательности PostgreSQL корректируются.
Пути фотографий сохраняются; сами файлы нужно перенести отдельно в MEDIA_ROOT.
Старые naive-даты SQLite интерпретируются как UTC (стандарт SQLite CURRENT_TIMESTAMP).
После проверки данных переключите DATABASE_URL и у API, и у бота.
Для ранее созданной PostgreSQL без Alembic сначала сверяют её с миграцией 0001;
`alembic stamp 0001` допустим только после подтверждения полного совпадения схемы.

## Проверки

```powershell
$env:PYTHONPATH = ".."
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m scripts.export_openapi
```

Чтобы проверить PostgreSQL, укажите `TEST_POSTGRES_URL` с драйвером
`postgresql+psycopg`. Тесты создают отдельные схемы `qa_*` и удаляют только их.
Проверяются авторизация, CSRF, изоляция домов/квартир, запись и повторная отправка,
показания, миграции и перенос SQLite. Без переменной PostgreSQL-проверки миграций
пропускаются, остальные выполняются на временной SQLite.

## Compose

```powershell
docker compose up --build -d
docker compose logs -f api
docker compose down
```

Compose запускает PostgreSQL, одноразовые миграции и API. Данные остаются в volume;
`down -v` удаляет их. Бот и frontend запускаются отдельно. Для frontend порт 3000,
для API 8000, для PostgreSQL 5432. Docker-образ в этой среде не проверен запуском:
Docker Engine недоступен; PostgreSQL-тесты выполнены с локальным PostgreSQL 17.

`DATA-API.yaml` остаётся черновиком материалов трека: публичный HTTPS, учётные
записи проверки и точную схему файла необходимо согласовать перед сдачей.
