# Запуск в Docker

Из корня `Project_Smart_City`, Docker Desktop с Linux containers / Docker Engine
и Docker Compose v2. Используется общий `compose.yaml`.

## Настройки

На этом компьютере `.env.docker` уже подготовлен: отдельные пароли PostgreSQL
и локальной сессии, существующие ключи из `.env`. Он исключён из Git.
Для новой установки скопируйте `.env.docker.example` в `.env.docker`, заполните
ключи и замените оба `CHANGE_ME` случайными значениями. Пароль PostgreSQL должен
состоять из URL-safe символов (буквы, цифры, `_`, `-`), поскольку он входит в URL.
Существующий `.env.docker` не перезаписывайте.

## Локальная разработка без MAX

```powershell
docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml up -d --build
```

Поднимаются PostgreSQL, миграции, создание проверочного жителя, API и frontend.
Вход в браузере — локальный, с переключателем MAX. Создание жителя повторно
не меняет существующие записи. Данные находятся в PostgreSQL, обращения и сообщения
сохраняются обычными запросами API. Для локального входа используйте `localhost`
либо `127.0.0.1`, не LAN-адрес компьютера.

Локальный override выделяет сеть `172.28.74.0/24` и разрешает локальные сессии
из неё. Если сеть уже занята, измените `LOCAL_DOCKER_SUBNET` в `.env.docker`.
Без override разрешены только loopback-адреса, локальный вход выключен.

## Все приложения, включая чатбот

Заполните `BOT_TOKEN`, `YANDEX_API_KEY`, `YANDEX_FOLDER_ID` в `.env.docker`:

```powershell
docker compose --env-file .env.docker --profile bot up -d --build
```

Для одновременного локального входа и бота:

```powershell
docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml --profile bot up -d --build
```

Бот выделен в профиль, поскольку требует внешних ключей и запускает polling MAX.
Не запускайте второй экземпляр polling для того же бота. Существующая webhook-
подписка останавливает запуск бота; переключение webhook здесь не производится.

## Адреса и конфигурация

- Frontend: http://localhost:3000
- API и Swagger: http://localhost:8000/docs
- Готовность API и БД: http://localhost:8000/health/ready
- PostgreSQL доступен только контейнерам по `db:5432`.

Если локальные процессы уже заняли 3000/8000, остановите их либо задайте
`FRONTEND_PORT=3001`, `API_PORT=8001`,
`NEXT_PUBLIC_API_BASE_URL=http://localhost:8001/api/v1` и
`CORS_ORIGINS=["http://localhost:3001"]` в `.env.docker`.
`NEXT_PUBLIC_*` встраиваются при сборке, поэтому после изменения нужен `--build`.
Браузеру нужен внешний адрес API, а не имя Docker-сервиса `api`.

Обычный Compose использует авторизацию MAX. Для публичного развёртывания нужны
HTTPS/reverse proxy, публичные URL, точный CORS и `SESSION_COOKIE_SECURE=true`.
`compose.local.yaml` на публичном сервере не подключается.

## Сервисы и данные

| Сервис | Сборка | Назначение |
| --- | --- | --- |
| frontend | `mini-app/Dockerfile` | Next.js standalone, пользователь node |
| api | `backend/Dockerfile` | FastAPI, пользователь api |
| bot | `chatbot/Dockerfile` | MAX polling, пользователь bot |
| migrate | образ API | Alembic до запуска приложений |
| seed | образ API, только local override | Проверочный житель |
| db | официальный `postgres:17.6-bookworm` | PostgreSQL без лишнего собственного Dockerfile |

PostgreSQL хранится в volume `dompulse_postgres_data`, фотографии бота —
в `dompulse_media`. API пока не раздаёт фотографии, поэтому ему этот volume
не монтируется. Токены, локальные БД, сертификаты и `.env` в образы не копируются.
Миграции ждут готовности БД; API и бот ждут завершения миграций;
frontend ждёт готовности API.

Контейнерная PostgreSQL — отдельная база, не текущая локальная на порту 55432.
Существующие данные автоматически не переносятся. При необходимости используйте
`pg_dump` / `pg_restore` в пустую контейнерную базу до запуска приложений и seed.
Пароль `POSTGRES_PASSWORD` применяется при первом создании volume; изменение
переменной само по себе не меняет пароль уже существующей роли PostgreSQL.

## Проверка и остановка

```powershell
docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml config --quiet
docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml ps -a
docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml logs --tail=100 api frontend
docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml --profile bot down
```

`down` сохраняет данные. Не добавляйте `-v`, если volumes нужно сохранить.
После обновления схемы повторите `up -d --build`, простой `restart` не запускает
новые миграции и не пересобирает frontend.

Прежний `backend/compose.yaml` остаётся отдельным вариантом запуска только API
и PostgreSQL, со своими настройками из `backend/.env`. Для всего проекта
используйте корневой Compose; одновременно оба стека запускать не нужно.
