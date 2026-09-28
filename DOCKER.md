# Запуск в Docker

Команды выполняются из корня репозитория. Нужны Docker Engine с Linux-контейнерами и Docker Compose v2.

## Настройки

Создайте `.env.docker` по [.env.docker.example](.env.docker.example), если файла ещё нет. Замените оба `CHANGE_ME` разными случайными значениями. Пароль PostgreSQL входит в URL: используйте буквы, цифры, `_` и `-`. Для бота заполните `BOT_TOKEN`, `YANDEX_API_KEY` и `YANDEX_FOLDER_ID`.

Полный список параметров — в [README](README.md#запуск). Env-файлы с рабочими значениями не добавляются в Git.

## Локальная разработка

```sh
docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml up -d --build
```

Запускаются PostgreSQL, миграции, подготовка локального жителя, API и frontend. Данные жителя и квартиры синтетические; дальнейшие действия записываются в БД. В браузере используйте `localhost` или `127.0.0.1`. При конфликте сетей измените `LOCAL_DOCKER_SUBNET`.

Для запуска всех компонентов, включая бот:

```sh
docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml --profile bot up -d --build
```

Бот требует внешние ключи и работает через polling MAX. Не запускайте второй экземпляр того же бота. При активной webhook-подписке polling не запустится.

## Запуск без локального входа

```sh
docker compose --env-file .env.docker --profile bot up -d --build
```

Этот вариант не создаёт локального жителя и требует входа через MAX. Для публичного доступа дополнительно нужны HTTPS, reverse proxy и настройка URL мини-приложения: [развёртывание](deploy/README.md). Локальный override для публичного сервера не используется.

## Порты и сервисы

| Сервис | Назначение | Доступ |
| --- | --- | --- |
| `frontend` | Next.js standalone | `http://localhost:3000` |
| `api` | FastAPI | `http://localhost:8000/docs` |
| `db` | PostgreSQL 17 | `db:5432`, только контейнеры |
| `migrate` | Alembic перед запуском приложений | Одноразовая команда |
| `seed` | Локальный житель | Только local override |
| `bot` | MAX polling | Профиль `bot`, входящего порта нет |

Сборки используют [Dockerfile frontend](mini-app/Dockerfile), [API](backend/Dockerfile) и [бота](chatbot/Dockerfile). БД использует закреплённый образ PostgreSQL. Миграции ждут БД, приложения — миграции, frontend — готовность API.

Порты хоста задаются через `FRONTEND_PORT` и `API_PORT`. При их изменении обновите `NEXT_PUBLIC_API_BASE_URL` и `CORS_ORIGINS`. Браузеру нужен доступный с хоста адрес API, а не Docker-имя `api`. После изменения `NEXT_PUBLIC_*` нужна пересборка.

## Данные

PostgreSQL хранится в volume `dompulse_postgres_data`, фотографии бота — в `dompulse_media`. API пока не раздаёт фотографии. Данные из внешней БД автоматически не переносятся; перед переносом нужны резервная копия и отдельное восстановление.

`POSTGRES_PASSWORD` применяется при создании базы в пустом volume. Изменение переменной не меняет пароль существующей роли PostgreSQL.

Дополнительное заполнение через `SAMPLE_DATA_ENABLED` описано в [backend README](backend/README.md#данные-для-проверки). Одна запись флага в `.env.docker` не передаёт его автоматически: он должен быть указан в `environment` нужного сервиса Compose.

## Диагностика, остановка и повторный запуск

Для локального варианта:

```sh
docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml config --quiet
docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml --profile bot ps -a
docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml --profile bot logs --tail=100 api frontend bot
docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml --profile bot down
docker compose --env-file .env.docker -f compose.yaml -f compose.local.yaml --profile bot up -d --build
```

Готовность API и соединение с БД: `http://localhost:8000/health/ready`. Без сессии `/api/v1/me` возвращает 401.

`down` сохраняет volumes; `down -v` удаляет данные. Обычный `restart` не пересобирает frontend, не применяет новые env-настройки и не запускает миграции. После изменений используйте `up -d --build`.

Отдельный [backend/compose.yaml](backend/compose.yaml) запускает только API и БД со своими настройками из `backend/.env`. Для всего проекта используйте корневой Compose.
