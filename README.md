# Умный город

Один репозиторий для MAX-бота, HTTP backend и мини-приложения. Бот и backend используют общие модели БД и сервисы из `app`.

Запуск всего проекта в контейнерах: [DOCKER.md](DOCKER.md).

## Запуск бота

Из корня проекта:

```powershell
.\.venv\Scripts\python.exe -m chatbot
```

Если venv активирован, достаточно `python -m chatbot`. Остановка — Ctrl+C. Настройка `PYTHONPATH` не нужна. Старый запуск `python -m app.main` заменён на новую команду.

Для первоначальной установки:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Создайте `.env` в корне по шаблону `.env.example`, если его ещё нет, и заполните `BOT_TOKEN`, `YANDEX_API_KEY`, `YANDEX_FOLDER_ID`. Уже существующий файл заменять не нужно. Переменные окружения имеют приоритет над `.env`.

## Запуск backend

В другом терминале:

```powershell
cd backend
$env:PYTHONPATH = ".."
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn smart_city_api.main:app --host 127.0.0.1 --port 8000 --loop smart_city_api.runtime:loop_factory
```

API: http://localhost:8000. Проверка БД: `/health/ready`, документация: `/docs`.

Установка зависимостей, PostgreSQL и настройки описаны в [backend/README.md](backend/README.md). Реализованы авторизация MAX, обращения, сообщения, квитанции и показания счётчиков. Для входа нужен токен бота; временного входа без MAX нет.

## Мини-приложение

```powershell
cd mini-app
npm ci
npm run dev
```

Подробности: [mini-app/README.md](mini-app/README.md). Интерфейс получает данные из API; при отсутствии данных показывает пустое состояние.

## Структура и ответственность

```text
Project_Smart_City/
├── chatbot/
│   ├── __main__.py          # команда python -m chatbot
│   ├── main.py              # сборка и запуск бота
│   ├── max_client.py        # адаптер MAX API
│   ├── handlers/            # текущие обработчики и сценарии
│   ├── keyboards/           # кнопки
│   ├── lexicon/             # тексты сообщений
│   ├── states/              # FSM
│   ├── filters/
│   ├── middlewares/
│   └── services/            # черновик и текст статистики для бота
├── backend/
│   ├── smart_city_api/      # FastAPI, маршруты, сервисы и схемы
│   ├── migrations/          # версии схемы PostgreSQL
│   ├── scripts/             # импорт прежней SQLite
│   └── tests/               # проверки API и миграций
├── app/                     # общая библиотека Python
│   ├── paths.py             # единый корень проекта
│   ├── config_data/         # настройки
│   ├── database/            # модели, репозитории, сессии и запросы
│   ├── services/            # создание обращений и анализ описания
│   ├── ai/                  # Яндекс: клиент, промпт и схема ответа
│   ├── storage/             # хранение фотографий
│   └── integrations/        # общий TLS-контекст
├── mini-app/                # Next.js frontend
├── certs/                   # сертификаты
├── data/                    # локальная БД и фотографии, вне Git
├── .env                     # локальные секреты, вне Git
├── .env.example
├── requirements.txt
└── requirements-dev.txt
```

Бот и backend импортируют общие функции `app`, но запускаются отдельными процессами и используют свои сессии БД. Общий код не импортирует бот или backend. Модели таблиц не нужно копировать в backend. Черновик MAX-сообщения и форматирование текста статистики находятся в `chatbot/services`, так как относятся к интерфейсу бота.

`DATABASE_URL`, `MEDIA_ROOT` и `MAX_CA_BUNDLE`, если содержат относительные пути, разрешаются от корня репозитория. Рабочая БД — PostgreSQL через `DATABASE_URL`; медиа — `data/media`, сертификаты — `certs`. Папки данных и сертификатов при переносе не перемещались.

Бот и API используют одну PostgreSQL и общие ORM-модели. Перед запуском выполняются миграции из `backend`; автоматического изменения PostgreSQL при старте нет. Для фотографий обоим процессам нужен доступ к MEDIA_ROOT. Подробности запуска и переноса SQLite: [backend/README.md](backend/README.md). Мини-приложение подключено к HTTP API: [mini-app/README.md](mini-app/README.md).

## Проверки

В `backend`: `python -m pytest`, `python -m ruff check .`. Для проверки PostgreSQL задайте `TEST_POSTGRES_URL` отдельной проверочной базы; подробности в backend README.

В `mini-app`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

Live-проверка внутри MAX требует токена бота, зарегистрированного пользователя с квартирой и доступных HTTPS-адресов frontend и API.
