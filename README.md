# Repay

Non-custodial платёжная система для онлайн-бизнеса: разовые платежи и подписки в USDT/USDC (Arbitrum, Base, Polygon).
План MVP: [docs/MVP_PLAN.md](docs/MVP_PLAN.md).

## Структура

```
apps/api/src/
  main.ts / app.module.ts                HTTP API (Postgres; в очереди не пишет — outbox)
  main.worker.ts / worker.module.ts      воркер без HTTP; роли через WORKER_ROLES
  config/       *.config.ts (registerAs: app, database, redis, worker) + env.validation.ts (zod)
  database/     DatabaseModule (Drizzle + pg), schema.ts
  queue/        QueueModule (BullMQ), имена очередей, проверка Redis при старте
  modules/      health, merchants, invoices, subscriptions, webhooks, chain,
                detector, sweeper, indexer, keeper
packages/       contracts, shared, sdk (по роадмапу)
```

Правила:
- Конфиг читается через `@Inject(xxxConfig.KEY) cfg: ConfigType<typeof xxxConfig>` — типизировано, без строковых ключей.
- **Postgres — источник правды**, Redis/BullMQ — транспорт. Любую задачу можно восстановить из БД.
- Смена статуса + событие вебхука пишутся **в одной транзакции** (outbox-таблица `webhook_events`).
- On-chain транзакции отправляются только через очередь `tx-<chainId>` с `concurrency = 1`.

## Локальный запуск

Требуется: Bun ≥ 1.3, Node ≥ 22, Docker.

```bash
bun install

cp .env.example .env               # порты Postgres/Redis на хосте
cp apps/api/.env.example apps/api/.env
bun run infra:up                   # Postgres 17 + Redis 7 (noeviction, AOF)

bun run dev:api                    # http://localhost:3000/health/ready
bun run dev:worker                 # все роли в одном процессе
```

> Если порты 5432/6379 заняты (локальный PostgreSQL или чужой Redis), задайте другие
> `POSTGRES_PORT`/`REDIS_PORT` в корневом `.env` и те же значения в `DB_PORT`/`REDIS_PORT` в `apps/api/.env`.

## Проверки

```bash
bun run lint
bun run typecheck
bun run test                       # unit
bun run --filter @repay/api test:e2e
```

## Прод

Один образ, разные команды:
- `node dist/main.js`
- `WORKER_ROLES=detector,sweeper node dist/main.worker.js`
- `WORKER_ROLES=indexer,keeper,webhooks node dist/main.worker.js`
