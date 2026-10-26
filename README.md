# Идея — тудулист лаборатории

Веб-приложение для задач лаборатории: интерфейс повторяет «Заметки» на iOS/macOS
(три колонки: папки → список → редактор с автосохранением), бэкенд на Go,
данные в PostgreSQL. Две роли: **лаборант** и **администратор**, для второго —
отдельная админ-панель со сменой ролей.

```
OKSEI-TDL
├── backend/            Go 1.26, net/http, pgx, JWT в httpOnly-cookie
│   ├── cmd/server/     точка входа
│   └── internal/
│       ├── api/        роутинг, middleware, обработчики
│       ├── auth/       bcrypt, JWT, cookie
│       ├── config/     переменные окружения
│       ├── models/     сущности
│       └── store/      SQL-запросы и миграции
├── frontend/           React 19 + TypeScript + Vite, свой CSS без UI-библиотек
└── docker-compose.yml  db + api + nginx
```

## Возможности

**Лаборант**
- Задачи с заголовком, описанием, сроком, отметкой «важное» и статусом выполнения.
- Папки: создание, переименование, удаление (задачи при этом сохраняются).
- Смарт-списки: «Все», «Сегодня», «Важные», «Выполненные» со счётчиками.
- Поиск по заголовку и тексту, автосохранение при вводе (как в «Заметках»).
- Чек-листы внутри описания: строки вида `- [ ] пункт` переключаются в один клик.
- Общая лента **«Лаборатория»**: все заметки сотрудников, к каждой можно оставить комментарий.
- Светлая и тёмная темы (системная / принудительная), адаптив под телефон.

**Администратор** (`/admin`)
- Обзор: пользователи, задачи, просрочки, активность за 7 дней.
- Пользователи: поиск, фильтр по роли, **смена роли лаборант ↔ администратор**,
  блокировка доступа, сброс пароля, правка имени и email, удаление, создание вручную.
- Журнал: кто и когда менял роли и доступы.

Защита от самоблокировки: нельзя снять роль/заблокировать/удалить себя, а также
нельзя оставить систему без активного администратора.

## Быстрый старт (Docker)

```bash
cp .env.example .env      # задайте пароли и JWT_SECRET
docker compose up -d --build
```

Приложение: `http://localhost:${HTTP_PORT}` (по умолчанию порт 80).
Первый вход — под `ADMIN_EMAIL` / `ADMIN_PASSWORD` из `.env`. Стартовый админ
создаётся только если в базе ещё нет ни одного администратора.

Полезное:

```bash
docker compose logs -f api      # логи бэкенда
docker compose ps               # состояние сервисов
docker compose down             # остановить (данные останутся в томе pgdata)
```

## Локальная разработка без Docker

```bash
# 1. Postgres (или свой инстанс)
docker run -d --name oksei-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=dev -e POSTGRES_USER=oksei -e POSTGRES_DB=oksei postgres:17-alpine

# 2. Бэкенд на :8080
cd backend
export DATABASE_URL="postgres://oksei:dev@localhost:5432/oksei?sslmode=disable"
export JWT_SECRET="dev_secret_change_me_please"
export ADMIN_EMAIL="admin@oksei.local" ADMIN_PASSWORD="admin12345"
go run ./cmd/server

# 3. Фронтенд на :5173 (запросы /api проксируются на :8080)
cd frontend
npm install
npm run dev
```

Проверки: `go vet ./...` в `backend`, `npm run build` в `frontend`.

## Переменные окружения бэкенда

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `DATABASE_URL` | — (обязательна) | строка подключения к PostgreSQL |
| `JWT_SECRET` | — (обязательна, ≥16 символов) | подпись сессионных токенов |
| `PORT` | `8080` | порт HTTP-сервера |
| `TOKEN_TTL` | `720h` | срок жизни сессии |
| `COOKIE_SECURE` | `false` | `true` для сайта по HTTPS |
| `ALLOW_REGISTRATION` | `true` | `false` — самостоятельная регистрация закрыта, учётки создаёт админ |
| `COOKIE_NAME` | `oksei_token` | имя cookie сессии |
| `COOKIE_DOMAIN` | пусто | домен cookie, если нужен |
| `ADMIN_EMAIL` | `admin@oksei.local` | email стартового администратора |
| `ADMIN_PASSWORD` | пусто | пароль стартового администратора |
| `ALLOWED_ORIGINS` | пусто | CORS-источники через запятую (для отдельного домена фронта) |
| `STATIC_DIR` | пусто | если задан, Go сам раздаёт собранный фронт (без nginx) |

## API

Все ответы — JSON, ошибки в виде `{"error": "текст"}`. Сессия хранится в
httpOnly-cookie, поэтому фронтенд не держит токен в localStorage.

| Метод и путь | Кто | Описание |
| --- | --- | --- |
| `GET /api/config` | все | открыта ли регистрация (для экрана входа) |
| `POST /api/auth/register` | все | регистрация (всегда роль `lab`, если разрешена) |
| `POST /api/auth/login` | все | вход (не более 10 попыток в минуту с одного IP) |
| `POST /api/auth/logout` | все | выход |
| `GET /api/auth/me` | сессия | текущий пользователь |
| `PATCH /api/auth/me` | сессия | изменить имя |
| `POST /api/auth/password` | сессия | сменить свой пароль |
| `GET/POST /api/folders` | сессия | список и создание папок |
| `PATCH/DELETE /api/folders/{id}` | сессия | переименование и удаление |
| `GET /api/tasks?scope=all\|today\|done\|pinned\|lab&folder={id}&q=` | сессия | список задач (`lab` — заметки всей лаборатории) |
| `GET /api/tasks/counters` | сессия | счётчики для сайдбара |
| `POST /api/tasks` | сессия | создать задачу |
| `GET /api/tasks/{id}` | сессия | любая заметка лаборатории (для комментариев) |
| `PATCH/DELETE /api/tasks/{id}` | автор / админ | частичное обновление и удаление |
| `GET/POST /api/tasks/{id}/comments` | сессия | список и новый комментарий |
| `PATCH /api/comments/{id}` | автор | правка своего комментария |
| `DELETE /api/comments/{id}` | автор / владелец заметки / админ | удаление комментария |
| `GET /api/admin/users?q=&role=` | админ | пользователи со статистикой |
| `POST /api/admin/users` | админ | создать пользователя |
| `PATCH /api/admin/users/{id}` | админ | имя и email |
| `PUT /api/admin/users/{id}/role` | админ | сменить роль (`lab` / `admin`) |
| `PUT /api/admin/users/{id}/active` | админ | открыть или закрыть доступ |
| `POST /api/admin/users/{id}/password` | админ | сбросить пароль |
| `DELETE /api/admin/users/{id}` | админ | удалить пользователя и его задачи |
| `GET /api/admin/stats` | админ | сводка |
| `GET /api/admin/audit?limit=` | админ | журнал действий |

Каждый запрос сверяет роль и активность пользователя с базой, поэтому смена роли
или блокировка действуют сразу, без ожидания истечения токена.

## Деплой на сервер

1. Установите Docker и плагин Compose, скопируйте проект на сервер.
2. Заполните `.env`: сильные `POSTGRES_PASSWORD`, `JWT_SECRET` (`openssl rand -base64 48`),
   `ADMIN_PASSWORD`, и `HTTP_PORT=8080`, если снаружи будет системный nginx с TLS.
3. `docker compose up -d --build`
4. HTTPS: выпустите сертификат (`certbot`) и поставьте перед контейнером
   host-nginx, например:

```nginx
server {
    listen 443 ssl http2;
    server_name tdl.example.ru;

    ssl_certificate     /etc/letsencrypt/live/tdl.example.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tdl.example.ru/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

   После включения HTTPS поставьте `COOKIE_SECURE=true` в `.env` и выполните
   `docker compose up -d`.

5. Бэкап базы: `docker compose exec db pg_dump -U oksei oksei > backup.sql`.
   Восстановление: `docker compose exec -T db psql -U oksei oksei < backup.sql`.

Обновление кода:

```bash
git pull && docker compose up -d --build
```

Миграции применяются автоматически при старте `api`: SQL-файлы из
`backend/internal/store/migrations` выполняются по одному разу и отмечаются в
таблице `schema_migrations`. Новая миграция — просто новый файл `0002_*.sql`.
# dash
