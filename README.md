# Project Smart City

Учебный проект для хакатона «Умный город»: бот на платформе MAX и будущая интеграция с мини-приложением.

## Текущий статус

Сейчас реализован первый технический каркас:

- бот запускается в режиме локального polling;
- токен загружается из `.env`;
- SSL-соединение с API MAX настраивается через сертификаты из `certs/`;
- команды бота задаются в `app/keyboards/main_menu.py`;
- обработчики разделены на `user_handlers.py` и `other_handlers.py`;
- тексты сообщений хранятся в `app/lexicon/lexicon.py`;
- добавлена базовая заготовка SQLAlchemy в `app/database/models.py`.

Предметные функции проекта — жалобы, здоровье дома и камеры — пока не реализованы. В `mini-app/` находится начальный каркас frontend на Next.js. Инструкция по запуску: [mini-app/README.md](mini-app/README.md).

## Запуск

Из корня проекта:

```powershell
cd C:\Users\kvmar\Desktop\Project_Smart_City
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m app.main
```

Токен хранится в локальном файле `.env`, который не добавляется в Git. Шаблон переменных находится в `.env.example`.

## Структура

```text
app/
├── main.py                  # запуск бота и подключение роутеров
├── config_data/config.py    # настройки из .env
├── max_client.py            # адаптер MAX API
├── tls.py                   # SSL-контекст для API MAX
├── handlers/                # обработчики событий MAX
├── keyboards/               # команды и будущие кнопки
├── lexicon/                 # тексты сообщений
├── database/                # будущие модели, сессии и запросы БД
└── services/                # будущая бизнес-логика
```

## Важно

Не записывай токены и другие секреты в Python-файлы, README или Git. Для локальных секретов используй `.env`. Перед первым коммитом проверь `git status` и убедись, что `.env` в список изменений не попал.
