# Repay — план MVP non-custodial платёжной системы для бизнеса (4 недели)

> **Продукт:** платёжная система для онлайн-бизнеса (сайты, SaaS, Telegram-боты), которая принимает USDT/USDC.
> Два модуля на общей платформе:
> 1. **Payments** — разовые платежи (инвойсы, платёжные ссылки, hosted checkout). Это ядро: разовые платежи нужны всем мерчантам.
> 2. **Subscriptions** — рекуррентные автосписания. Отличает нас от конкурентов.
>
> **Модель:** non-custodial. Средства идут покупатель → смарт-контракт с неизменяемой логикой → мерчант. Комиссия платформы удерживается в контракте. Платформа не может перенаправить средства.
> **Сети:** Arbitrum, Polygon, Base. **Токены:** USDT / USDC. **Стек:** TypeScript (ESM), NestJS, PostgreSQL, Redis, Next.js, Hardhat 3, Solidity, Viem / Wagmi, Vitest.
>
> Отмечайте пункты: `- [ ]` → `- [x]`.

---

## Содержание

0. [Продукт, принципы и что НЕ делаем](#0-продукт-принципы-и-что-не-делаем)
1. [Архитектура системы](#1-архитектура-системы)
2. [Роадмап по неделям](#2-роадмап-по-неделям)
3. [Смарт-контракты](#3-смарт-контракты)
4. [Чек-лист перед мейннетом](#4-чек-лист-перед-мейннетом)
5. [Привлечение первых 20 мерчантов](#5-привлечение-первых-20-мерчантов)
6. [Бюджет $2000](#6-бюджет-2000)
7. [Риски и бэклог v1.1](#7-риски-и-бэклог-v11)
8. [Метрики успеха MVP](#8-метрики-успеха-mvp)

---

## 0. Продукт, принципы и что НЕ делаем

### 0.1 Возможности MVP

| Модуль | Для мерчанта | Для покупателя |
|---|---|---|
| **Payments** | API инвойсов, платёжные ссылки, вебхуки, дашборд, CSV-экспорт, помощник возвратов | Оплата **с биржи или любого кошелька** обычным переводом на адрес (без approve, без газа на бирже) или через WalletConnect |
| **Subscriptions** | Продукты с периодом, автосписания, статусы, вебхуки | Одна подписка через кошелёк, дальше списания автоматически, отмена в 1 клик |

### 0.2 Ключевое архитектурное решение: deposit-адреса для разовых платежей

Для каждого инвойса генерируется **уникальный адрес** (CREATE2-клон контракта-форвардера). У этого адреса есть три свойства:
- Его код позволяет отправить средства **только** на `payee` мерчанта (минус комиссия → treasury). Payee и комиссия «зашиты» в сам адрес через salt, поэтому подменить их нельзя.
- Покупатель делает **обычный перевод USDT/USDC**: с Binance, Bybit, OKX, из Trust Wallet, откуда угодно. Approve и вызов контракта не нужны. Это критично для конверсии в СНГ.
- Адрес **одинаковый во всех трёх сетях** (одна фабрика по одному адресу). Если покупатель отправит не в ту сеть из поддерживаемых, платёж всё равно дойдёт.

Подписки требуют on-chain согласия подписчика (approve + `subscribe`), поэтому они работают только через подключённый кошелёк.

### 0.3 Принципы
- Контракты минимальные (~300 SLOC суммарно), без upgradeable-прокси. Новая версия выпускается как новый деплой.
- Контракты **не позволяют** owner'у двигать средства пользователей или мерчантов. Owner может только: пауза, комиссия для **новых** инвойсов и подписок (с жёстким потолком), treasury, whitelist токенов.
- Операции `sweep` и `charge` permissionless. Если ключ keeper'а утечёт, теряется только газ.
- Источник правды — блокчейн. Статусы в БД выводятся из on-chain данных.
- Суммы инвойсов в USD, USDT и USDC принимаются как 1:1. Котировки и курсовой риск не нужны.
- Owner — Safe multisig.

### 0.4 Вне скоупа MVP
- Фиатный on/off-ramp, свопы, волатильные монеты (ETH, BTC) как средство оплаты
- TRON / Solana / TON (см. риски)
- Gasless-подписка через подписи (v1.1)
- Календарные месяцы для подписок (в MVP «месяц» = 30 дней)
- Плагины CMS (WooCommerce, Tilda) — v1.1
- Upgradeable-прокси, собственный токен
- Автоматические возвраты из контракта: возврат делает мерчант из своего кошелька, дашборд помогает собрать транзакцию

---

## 1. Архитектура системы

### 1.1 Компоненты

```
┌──────────────────────┐  POST /v1/invoices | /v1/checkout-sessions  ┌─────────────────────────────┐
│ Мерчант (сайт/SaaS/  │ ──────────────────────────────────────────▶ │ API (NestJS)                │
│ TG-бот) + SDK        │ ◀──────────── webhooks (HMAC) ───────────── │ merchants, keys, invoices,  │
└──────────────────────┘                                             │ sessions, payment links     │
          │ redirect на hosted checkout                               └──────────┬──────────────────┘
          ▼                                                          PostgreSQL + Redis (BullMQ)
┌──────────────────────┐                                             ┌──────────┴──────────────────┐
│ Checkout (Next.js)   │  A) перевод USDT/USDC на deposit-адрес ────▶│ Payment Detector            │
│ QR + адрес | wagmi   │  B) approve + subscribe ─────┐              │ multicall balanceOf по      │
└──────────────────────┘                              │              │ активным инвойсам           │
                                                      ▼              ├─────────────────────────────┤
     ┌────────────────────────────┐   ┌────────────────────────┐    │ Sweeper: sweep() → мерчант  │
     │ DepositFactory + Forwarder │   │ RepaySubscriptions     │    ├─────────────────────────────┤
     │ (CREATE2-клоны на инвойс)  │   │ (approve-based pull)   │    │ Indexer: события контрактов │
     └────────────────────────────┘   └────────────────────────┘    ├─────────────────────────────┤
                   ▲ sweep(...)                  ▲ charge(id)        │ Keeper: due-подписки        │
                   └─────────────────────────────┴──────────────────│ Webhook dispatcher          │
                                                                     └─────────────────────────────┘
```

| Компонент | Ответственность |
|---|---|
| **DepositFactory / DepositForwarder** | CREATE2-клон на каждый инвойс; `sweep` разносит баланс между payee и treasury. Одинаковый адрес во всех сетях. |
| **RepaySubscriptions** | Условия подписок, контроль сроков, pull-списания через allowance. |
| **API** (`apps/api`) | Мерчанты (SIWE), API-ключи, инвойсы, платёжные ссылки, продукты/цены, checkout-сессии, вебхуки. |
| **Payment Detector** | Раз в 5–10 с читает `balanceOf` deposit-адресов активных инвойсов (multicall) с учётом подтверждений; обновляет статусы. |
| **Sweeper** | Для оплаченных инвойсов вызывает `sweep`: деплой клона при необходимости + перевод. Повторы, отслеживание газа. |
| **Indexer** | `getLogs` по `Swept`, `SubscriptionCreated`, `Charged`, `Cancelled`; курсор, подтверждения, reorg. Финальная сверка. |
| **Keeper** | Due-подписки → simulate → `charge`. |
| **Webhook dispatcher** | BullMQ, HMAC-подпись, ретраи, лог доставок. |
| **Next.js** (`apps/web`) | Лендинг, документация, checkout `/pay/[invoiceId]` и `/subscribe/[sessionId]`, платёжные ссылки `/l/[slug]`, портал подписчика `/manage`, дашборд мерчанта. |
| **SDK** (`packages/sdk`) | `createInvoice`, `createCheckoutSession`, `verifyWebhook`, типы. Пример TG-бота. |

### 1.2 Поток разового платежа (Payments)

1. Мерчант вызывает `POST /v1/invoices {amount: "25.00", orderId, successUrl, expiresIn: 3600, metadata}`.
2. API вычисляет `invoiceKey = keccak256(uuid)` и deposit-адрес = `factory.addressOf(payee, feeBps, invoiceKey)` (off-chain через viem `getContractAddress` CREATE2), затем возвращает `{id, url, address, amount, networks}`.
3. Покупатель открывает checkout, выбирает сеть и токен, видит адрес + QR + точную сумму + таймер. Варианты оплаты:
   - перевод с биржи или любого кошелька;
   - «Подключить кошелёк» → одна транзакция `token.transfer(address, amount)` через wagmi.
4. Detector видит баланс ≥ суммы с N подтверждениями. Статус становится `paid` (или `underpaid` / `overpaid`), мерчанту уходит вебхук.
5. Sweeper вызывает `sweep(payee, feeBps, invoiceKey, token)`: мерчант получает `amount − fee`, treasury получает `fee`. Indexer видит `Swept`, статус становится `settled`.
6. Платёж после истечения срока всё равно уходит мерчанту при следующем sweep. Статус `paid_late`, мерчант решает, выполнять ли заказ.

**Статусы инвойса:** `pending → confirming → paid | underpaid | overpaid → settled`; `pending → expired → (paid_late)`.

### 1.3 Поток подписки (Subscriptions)

1. Мерчант вызывает `POST /v1/checkout-sessions {priceId, customerRef, successUrl}` и получает `url`.
2. Покупатель подключает кошелёк → `approve(contract, amount × N)` → `subscribe(token, payee, amount, period, maxCharges, ref)`. Первое списание проходит сразу.
3. Indexer видит `SubscriptionCreated` + `Charged`, сверяет условия с сессией и шлёт вебхуки `subscription.activated` и `invoice.paid`.
4. Когда наступает `next_charge_at`, keeper вызывает `charge(id)`, мерчанту уходит `invoice.paid`.
5. Если не хватает баланса или allowance, статус становится `past_due`, keeper ретраит в окне GRACE. После окна статус `expired`.
6. Отмену делает подписчик (`/manage`) или мерчант через `cancel(id)`.

### 1.4 Схема БД (минимум)

**Общее**
- [ ] `merchants` (id, wallet_address, name, email, fee_bps, created_at)
- [ ] `payout_addresses` (merchant_id, address) — один EVM-адрес на все сети, при желании свой на каждую
- [ ] `api_keys` (merchant_id, prefix, sha256_hash, mode test/live, last_used_at, revoked_at)
- [ ] `webhook_endpoints`, `webhook_events` (id, type, payload), `webhook_deliveries` (event_id, attempt, status, next_retry_at)
- [ ] `chain_events` (chain_id, block_number, block_hash, tx_hash, log_index, name, args jsonb) — UNIQUE (chain_id, tx_hash, log_index)
- [ ] `indexer_cursors` (chain_id, contract, last_block)

**Payments**
- [ ] `invoices` (id, merchant_id, order_id, amount_usd, invoice_key, deposit_address, payee, fee_bps, status, expires_at, success_url, metadata) — UNIQUE (merchant_id, order_id)
- [ ] `invoice_deposits` (invoice_id, chain_id, token, amount, detected_at, confirmed_at)
- [ ] `sweeps` (invoice_id, chain_id, token, amount, fee, tx_hash, status)
- [ ] `payment_links` (merchant_id, slug, amount_usd или «свободная сумма», title, active)
- [ ] `refunds` (invoice_id, to_address, amount, tx_hash, status) — записи о возвратах, сделанных мерчантом

**Subscriptions**
- [ ] `products`, `prices` (amount, token, period_seconds, max_charges)
- [ ] `checkout_sessions` (id, price_id, customer_ref, ref_hash, status, expires_at)
- [ ] `subscriptions` (chain_id, onchain_id, session_id, subscriber, payee, token, amount, period, status, next_charge_at, charge_count) — UNIQUE (chain_id, onchain_id)
- [ ] `charges` (subscription_id, charge_index, amount, fee, tx_hash) — UNIQUE (subscription_id, charge_index)
- [ ] `charge_attempts` (subscription_id, attempted_at, result, error)

### 1.5 Публичное API v1
- [ ] `POST /v1/invoices`, `GET /v1/invoices/:id`, `GET /v1/invoices?orderId=`
- [ ] `POST /v1/payment-links`, `GET /v1/payment-links`
- [ ] `POST /v1/checkout-sessions`, `GET /v1/checkout-sessions/:id`
- [ ] `GET /v1/subscriptions/:id`, `GET /v1/subscriptions?customerRef=`, `POST /v1/subscriptions/:id/cancel` (возвращает данные транзакции для подписи мерчантом)
- [ ] Idempotency-Key на всех POST
- [ ] Test-режим: ключи `sk_test_*` → тестнеты
- [ ] Вебхуки Payments: `invoice.confirming`, `invoice.paid`, `invoice.underpaid`, `invoice.overpaid`, `invoice.expired`, `invoice.paid_late`, `invoice.settled`
- [ ] Вебхуки Subscriptions: `subscription.activated`, `subscription.charged`, `subscription.payment_failed`, `subscription.past_due`, `subscription.canceled`, `subscription.expired`

### 1.6 Структура приложения и очереди

**Модульный монолит, не микросервисы.** Одна кодовая база NestJS (`apps/api`), два типа процессов из одного Docker-образа:

| Процесс | Точка входа | Что делает | Зависимости |
|---|---|---|---|
| API | `main.ts` → `app.module.ts` | HTTP: API v1, дашборд, checkout | Postgres |
| Worker | `main.worker.ts` → `worker.module.ts` | Роли из `WORKER_ROLES`: `detector`, `sweeper`, `indexer`, `keeper`, `webhooks` | Postgres, Redis, RPC |

```
apps/api/src/
├── config/          *.config.ts (registerAs @nestjs/config) + env.validation.ts (zod)
├── database/        DatabaseModule (Drizzle), schema.ts
├── queue/           QueueModule (BullMQ), queue.constants.ts
├── modules/
│   ├── health/                                                 ← /health/live, /health/ready
│   ├── merchants/   invoices/   subscriptions/   webhooks/     ← домен
│   ├── chain/                                                  ← viem, отправка tx
│   └── detector/    sweeper/    indexer/    keeper/            ← роли воркера
├── app.module.ts    worker.module.ts (WorkerModule.forRoot)
└── main.ts          main.worker.ts
```

**Очереди: BullMQ на Redis, без RabbitMQ.** Нужна очередь заданий (ретраи с backoff, отложенные задачи, дедупликация по `jobId`, cron), а не шина событий.

**Правила**
- [x] Конфиг — `@nestjs/config`: `registerAs` по темам, доступ через `ConfigType<typeof xxxConfig>`, проверка zod-схемой при старте
- [x] API не пишет в очереди: событие кладётся в outbox (`webhook_events`) в той же транзакции, что и смена статуса
- [x] Postgres — источник правды; задачи воркеров восстанавливаются из БД, если Redis потеряет данные
- [x] Redis: `maxmemory-policy noeviction` + `appendonly yes`
- [x] On-chain транзакции — только через очередь `tx-<chainId>` с `concurrency = 1` (один кошелёк на сеть, нет конфликтов nonce)

**Когда пересматривать:** отдельный сервис подписи транзакций (изоляция ключей) — первый кандидат на вынос; RabbitMQ/Kafka — только при множестве независимых потребителей событий или потоке в тысячи сообщений в секунду.

---

## 2. Роадмап по неделям

### Неделя 1 — Фундамент + смарт-контракты

**День 1. Монорепо и окружение**
- [x] Bun workspaces: `apps/api` (текущий Nest); `apps/web`, `packages/*` — по мере появления
- [x] Общий `tsconfig.base.json` (ESM, `module: nodenext`, strict)
- [x] `docker-compose.yml`: Postgres 17 + Redis 7 (`noeviction`, AOF), порты настраиваются
- [x] `.env.example` и валидация конфигурации (zod) при старте
- [x] Каркас модульного монолита (раздел 1.6): `main.ts` + `main.worker.ts`, `config/`, `database/`, `queue/`, `modules/`, роли воркера
- [x] Health-эндпоинты (`/health/live`, `/health/ready`), проверка Redis при старте воркера
- [x] Vitest + SWC (DI-декораторы), unit- и e2e-тесты каркаса
- [ ] GitHub Actions: oxlint, typecheck, vitest, тесты контрактов, Slither
- [ ] RPC (Alchemy/QuickNode), ключ Etherscan V2, Reown/WalletConnect projectId
- [ ] **Забронировать аудитора на неделю 3**

**День 2. DepositFactory + DepositForwarder**
- [ ] Hardhat 3 + viem + OpenZeppelin (`Clones`, `SafeERC20`)
- [ ] `addressOf`, `sweep` (permissionless), `flush`, `flushNative`, whitelist fee-токенов, пауза
- [ ] Payee и feeBps «зашиты» в salt

**День 3. RepaySubscriptions**
- [ ] `subscribe`, `charge`, `cancel`, `isDue`, админ-функции (см. 3.3)
- [ ] События с полным набором полей для индексатора

**Дни 4–5. Тесты**
- [ ] Unit-тесты на все ветки обоих контрактов
- [ ] Fuzz и инварианты (см. 3.2.3 и 3.3.5)
- [ ] Моки: USDT-подобный токен (без return value), токен с blacklist, токен с реентрантностью
- [ ] Покрытие 100% строк и веток, Slither и Aderyn без high/medium

**День 6. Деплой в тестнеты**
- [ ] Детерминированный CREATE2-деплой (Ignition), **одинаковые аргументы конструктора во всех сетях**: начальный owner = деплойер, treasury задаётся потом
- [ ] Деплой в Base Sepolia, Arbitrum Sepolia, Polygon Amoy; проверить, что адрес фабрики одинаковый
- [ ] Верификация на эксплорерах, тестовые USDC/USDT (faucet или mock), whitelist

**День 7. Shared и буфер**
- [ ] ABI `as const`, адреса, конфиг сетей (chainId, RPC, токены, decimals, confirmations) в `packages/shared`
- [ ] Off-chain функция `depositAddress(payee, feeBps, invoiceKey)` + тест на совпадение с `factory.addressOf`
- [ ] Заморозить скоуп и отправить код аудитору

**Результат недели:** оба контракта в 3 тестнетах, полностью покрыты тестами, аудитор забронирован.

---

### Неделя 2 — Бэкенд: Payments-ядро, затем подписки

**День 1. Данные, auth, ключи**
- [ ] ORM (Drizzle или Kysely), миграции по схеме из 1.4
- [ ] SIWE-логин мерчанта (EIP-4361), сессии в Redis
- [ ] API-ключи: только sha256-хэш, guard, разделение test/live
- [ ] Payout-адрес мерчанта, rate limit, Idempotency-Key, Swagger

**День 2. Инвойсы и платёжные ссылки**
- [ ] `POST /v1/invoices`: генерация `invoiceKey`, вычисление deposit-адреса, срок жизни
- [ ] Платёжные ссылки: `/l/[slug]` создаёт инвойс на каждого посетителя
- [ ] UNIQUE `(merchant_id, order_id)` против дублей инвойсов

**День 3. Payment Detector**
- [ ] Отдельный entrypoint `worker:detector`
- [ ] Multicall `balanceOf` (USDT + USDC × 3 сети) по активным инвойсам на блоке `latest − N`
- [ ] Статусы: `confirming` → `paid` / `underpaid` / `overpaid`; допуск на недоплату настраивается (по умолчанию 0)
- [ ] Недоплата: покупатель может доплатить на тот же адрес до истечения срока
- [ ] После истечения — опрос раз в час ещё 30 дней (`paid_late`)

**День 4. Sweeper + вебхуки**
- [ ] BullMQ-задача `sweep` с jobId `chainId:invoiceId:token`, simulate → send, nonce manager
- [ ] Порог «пыли»: не делать sweep при сумме меньше $0.50 (газ)
- [ ] Indexer для `Swept` → статус `settled`, сверка суммы и комиссии
- [ ] Webhook dispatcher: `Repay-Signature: t=<ts>,v1=<hmac>`, экспоненциальные ретраи до ~24 ч, resend, тестовая отправка
- [ ] Алерт, если баланс газа на кошельке sweeper/keeper ниже порога

**День 5. Indexer + Keeper для подписок**
- [ ] Indexer: `getLogs` с курсором, подтверждения, `block_hash` + откат при reorg, идемпотентная запись
- [ ] Проекции: `SubscriptionCreated` (сверка с сессией → `active` | `invalid`), `Charged`, `Cancelled`
- [ ] Keeper: cron раз в минуту, `FOR UPDATE SKIP LOCKED`, jobId `chainId:subId:chargeIndex`, предпроверка баланса и allowance, simulate → send
- [ ] Ретраи `past_due` в пределах GRACE

**Дни 6–7. E2E**
- [ ] Vitest e2e на локальной ноде Hardhat: инвойс → перевод → detector → вебхук → sweep → `settled`
- [ ] Сценарии: недоплата + доплата, переплата, оплата после истечения, оплата в «другой» сети, два токена на один инвойс
- [ ] Подписки: subscribe → перемотка времени → charge → нехватка баланса → expired → отмена
- [ ] Логи (pino), Sentry

**Результат недели:** оба потока работают end-to-end через API на локальной ноде и в тестнете.

---

### Неделя 3 — Фронтенд, интеграции, старт продаж

**Дни 1–2. Checkout**
- [ ] `apps/web`: Next.js (App Router), wagmi + viem, Reown AppKit / RainbowKit
- [ ] `/pay/[invoiceId]`: сумма, выбор сети и токена, адрес + QR + кнопка «копировать», таймер, статус в реальном времени (polling/SSE)
- [ ] Предупреждения: «только сеть X», «отправьте ровно сумму с учётом комиссии вывода биржи»
- [ ] Кнопка «Оплатить кошельком» → `transfer` одной транзакцией
- [ ] `/subscribe/[sessionId]`: выбор сети и токена, проверка газа и баланса, approve (видимый лимит) → subscribe
- [ ] Редирект на `successUrl`, i18n RU/EN, мобильная вёрстка
- [ ] Встраиваемая кнопка `<script src=".../repay.js">` (popup/redirect)

**День 3. Портал подписчика**
- [ ] `/manage`: подключить кошелёк → подписки → отмена
- [ ] Показ allowance и кнопка «отозвать approve»

**День 4. Дашборд мерчанта**
- [ ] Онбординг: SIWE → payout-адрес → API-ключ → тестовый инвойс за 5 минут
- [ ] Инвойсы и платежи: фильтры, статусы, ссылки на эксплорер, экспорт в CSV
- [ ] Платёжные ссылки: создание, QR, отключение
- [ ] Продукты, цены, подписки
- [ ] Помощник возврата: мерчант подписывает `transfer` из своего кошелька, запись в `refunds`
- [ ] Вебхуки: настройка, лог доставок, тестовая отправка; переключатель Test/Live

**День 5. SDK и интеграции**
- [ ] `packages/sdk` (npm): `createInvoice`, `createPaymentLink`, `createCheckoutSession`, `verifyWebhook`, типы
- [ ] Open-source шаблон TG-бота (grammY): разовая оплата доступа и подписка; `createChatInviteLink(member_limit: 1)`, кик при `expired`/`canceled`
- [ ] Примеры для Next.js / Express

**День 6. Документация и лендинг**
- [ ] Docs: Quickstart, API reference, вебхуки, статусы инвойса, FAQ по безопасности (как работают deposit-адреса, что может и чего не может owner)
- [ ] Лендинг: оффер, комиссия, сравнение с кастодиальными шлюзами и картами, форма заявки
- [ ] ToS, Privacy Policy, страница Security (адреса контрактов, отчёт ревью)

**День 7. Параллельно: аудит и продажи**
- [ ] Аудитор работает над контрактами
- [ ] Outreach (раздел 5): 300 лидов в таблице, первые 100 сообщений
- [ ] 3–5 дружественных мерчантов интегрируются в тестнете

**Результат недели:** продукт полностью работает в тестнете, есть документация, лендинг и первые лиды.

---

### Неделя 4 — Харденинг, мейннет, первые клиенты

**Дни 1–2. Аудит и фиксы**
- [ ] Исправить находки, добавить регрессионные тесты на каждую
- [ ] Повторная проверка фиксов, повторный деплой в тестнет, полный E2E-прогон

**День 3. Прод-инфраструктура**
- [ ] VPS (Hetzner): Docker Compose — api, detector, sweeper, indexer, keeper, web, Postgres, Redis; Caddy (TLS)
- [ ] Cloudflare (DNS, WAF, rate limit)
- [ ] Бэкапы Postgres в объектное хранилище + **проверенное** восстановление
- [ ] Uptime-мониторинг, Sentry, алерты в Telegram
- [ ] Секреты только в env прод-сервера

**День 4. Мейннет (guarded launch)**
- [ ] Safe multisig 2/3 (аппаратные кошельки) в каждой сети
- [ ] CREATE2-деплой Base → Arbitrum → Polygon; **проверить, что адрес фабрики одинаковый**; верификация
- [ ] `setTreasury`, `setFee`, whitelist токенов, `setMaxAmount` для подписок (~$500) → `transferOwnership` на Safe → `acceptOwnership`
- [ ] Адреса USDC/USDT взяты из официальных источников Circle/Tether (USDT — только там, где он официально выпущен)
- [ ] Dogfooding: оплатить свой инвойс на $1 с биржи и из кошелька в каждой сети, оформить и отменить подписку

**Дни 5–7. Первые клиенты и публичный запуск**
- [ ] 3–5 пилотных мерчантов на live, сопровождение вручную
- [ ] Habr / vc.ru (технический разбор + кейс), тред в X, Product Hunt
- [ ] Ежедневно: конверсия checkout, доля `underpaid`, ошибки sweep/charge, обратная связь
- [ ] Страница статуса

**Результат недели:** мейннет в 3 сетях, 3–5 мерчантов на live, воронка до 20 запущена.

---

## 3. Смарт-контракты

### 3.1 Обзор

| Контракт | Назначение | Кто вызывает | Деньги пользователя |
|---|---|---|---|
| `DepositFactory` | Адрес инвойса, деплой клона, `sweep` | Кто угодно (sweeper) | Уходят только payee и treasury |
| `DepositForwarder` (клон EIP-1167) | Держит платёж до sweep | Только фабрика | Payee и feeBps неизменяемы |
| `RepaySubscriptions` | Подписки | Подписчик, payee, кто угодно (`charge`) | Pull через allowance в рамках условий |

### 3.2 DepositFactory + DepositForwarder

#### 3.2.1 Код (скелет)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

contract DepositForwarder {
    using SafeERC20 for IERC20;

    DepositFactory public immutable factory; // зашито в код implementation, общее для всех клонов
    address public payee;
    uint16 public feeBps;

    error OnlyFactory(); error AlreadyInit();

    constructor() { factory = DepositFactory(msg.sender); }

    function init(address payee_, uint16 feeBps_) external {
        if (msg.sender != address(factory)) revert OnlyFactory();
        if (payee != address(0)) revert AlreadyInit();
        payee = payee_; feeBps = feeBps_;
    }

    function flush(IERC20 token) external returns (uint256 amount, uint256 fee) {
        if (msg.sender != address(factory)) revert OnlyFactory();
        amount = token.balanceOf(address(this));
        if (amount == 0) return (0, 0);
        // комиссия только с whitelisted-стейблов; «чужие» токены целиком уходят мерчанту
        fee = factory.feeToken(address(token)) ? amount * feeBps / 10_000 : 0;
        token.safeTransfer(payee, amount - fee);
        if (fee != 0) token.safeTransfer(factory.treasury(), fee);
    }

    function flushNative() external returns (uint256 amount) {
        if (msg.sender != address(factory)) revert OnlyFactory();
        amount = address(this).balance;
        (bool ok, ) = payee.call{value: amount}("");
        require(ok, "native transfer failed");
    }

    receive() external payable {}
}

contract DepositFactory is Ownable2Step, Pausable {
    uint16 public constant MAX_FEE_BPS = 300; // 3% — жёсткий потолок

    address public immutable implementation;
    address public treasury;
    mapping(address => bool) public feeToken;

    event Swept(bytes32 indexed invoiceKey, address indexed forwarder, address indexed token,
        address payee, uint256 amount, uint256 fee);

    error BadAddress(); error FeeTooHigh();

    // Одинаковые аргументы во всех сетях → одинаковый адрес фабрики и клонов
    constructor(address initialOwner) Ownable(initialOwner) {
        implementation = address(new DepositForwarder());
        treasury = initialOwner;
    }

    function salt(address payee, uint16 feeBps, bytes32 invoiceKey) public pure returns (bytes32) {
        return keccak256(abi.encode(payee, feeBps, invoiceKey));
    }

    function addressOf(address payee, uint16 feeBps, bytes32 invoiceKey) public view returns (address) {
        return Clones.predictDeterministicAddress(implementation, salt(payee, feeBps, invoiceKey));
    }

    /// Permissionless: подставить другого payee нельзя — получится другой адрес.
    /// На паузе sweep может вызвать только сам payee: пауза не замораживает средства навсегда.
    function sweep(address payee, uint16 feeBps, bytes32 invoiceKey, IERC20 token) external {
        _checkPause(payee);
        address fwd = _ensure(payee, feeBps, invoiceKey);
        (uint256 amount, uint256 fee) = DepositForwarder(payable(fwd)).flush(token);
        emit Swept(invoiceKey, fwd, address(token), payee, amount, fee);
    }

    function sweepNative(address payee, uint16 feeBps, bytes32 invoiceKey) external {
        _checkPause(payee);
        address fwd = _ensure(payee, feeBps, invoiceKey);
        uint256 amount = DepositForwarder(payable(fwd)).flushNative();
        emit Swept(invoiceKey, fwd, address(0), payee, amount, 0);
    }

    function _checkPause(address payee) private view {
        if (paused() && msg.sender != payee) revert EnforcedPause();
    }

    function _ensure(address payee, uint16 feeBps, bytes32 invoiceKey) private returns (address fwd) {
        if (payee == address(0)) revert BadAddress();
        if (feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        bytes32 s = salt(payee, feeBps, invoiceKey);
        fwd = Clones.predictDeterministicAddress(implementation, s);
        if (fwd.code.length == 0) {
            Clones.cloneDeterministic(implementation, s);
            DepositForwarder(payable(fwd)).init(payee, feeBps);
        }
    }

    function setTreasury(address t) external onlyOwner { if (t == address(0)) revert BadAddress(); treasury = t; }
    function setFeeToken(address token, bool on) external onlyOwner { feeToken[token] = on; }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
```

> Это скелет для старта, а не код, готовый к продакшену. Его нужно покрыть тестами из 3.2.3 и пройти ревью.

#### 3.2.2 Защиты
- [ ] Payee и feeBps входят в salt: при подмене параметров получается другой адрес, где средств нет
- [ ] `feeBps ≤ MAX_FEE_BPS` проверяется в `sweep`; owner не может поднять комиссию уже выданных адресов (комиссия часть адреса)
- [ ] `init` и `flush` вызывает только фабрика; повторный `init` → `AlreadyInit`
- [ ] Owner не может вывести средства из форвардеров: таких функций нет
- [ ] Пауза останавливает только permissionless-sweep (sweeper и кто угодно). Payee может сделать sweep своих адресов и на паузе, поэтому потеря или компрометация ключа owner'а не замораживает средства навсегда
- [ ] Контракты не обновляемые (нет proxy/upgrade): логику нельзя подменить, но и баг нельзя исправить. План на случай бага: деплой новой фабрики, API перестаёт выдавать адреса старой, остатки на старых адресах выводятся старым кодом. Описать в runbook
- [ ] Адрес инвойса в блок-листе эмитента (Circle/Tether заморозили сам deposit-адрес, например после присланных туда украденных средств): средства на нём заблокированы эмитентом, контракт это не решает. Санкционный скрининг плательщика (4.4) + задокументировать для мерчантов
- [ ] Нестандартные токены (хуки при переводе как у ERC-777, комиссия за перевод, rebasing) не добавляются в whitelist. Повторный вход в `sweep` из хука не позволяет вывести больше баланса (тест в 3.2.3)
- [ ] Принятый риск: коллизия CREATE2-адреса с адресом, у которого есть приватный ключ (~2^80 вычислений, миллиарды долларов). Для MVP пренебрежимо; лимит на инвойс (4.1) ограничивает сумму на одном адресе
- [ ] Не-whitelisted токены и нативная монета уходят мерчанту без комиссии (восстановление ошибочных платежей)
- [ ] `SafeERC20` (USDT без return value)
- [ ] Детерминированный деплой фабрики с одинаковыми аргументами во всех сетях; owner передаётся на Safe уже после деплоя
- [ ] Payee в блок-листе USDT → `sweep` ревертится → алерт, мерчант меняет payout-адрес. Старые инвойсы привязаны к старому payee: задокументировать

#### 3.2.3 Тесты
- [ ] `addressOf` off-chain (viem) == on-chain == фактический адрес клона
- [ ] Платёж до деплоя клона → `sweep` деплоит клон и переводит средства
- [ ] Повторный `sweep` на том же адресе (доплата) работает, `init` повторно не вызывается
- [ ] Fuzz: `amount − fee` на payee + `fee` на treasury == баланс; `fee ≤ amount × 3%`
- [ ] `sweep` с чужим payee → средств нет (другой адрес)
- [ ] Прямой вызов `init`/`flush` на клоне или implementation → `OnlyFactory`
- [ ] Не-whitelisted токен → 100% на payee
- [ ] `sweepNative` работает; payee-контракт, который отклоняет ETH, → revert без потери средств
- [ ] Пауза блокирует sweep для всех, кроме payee; после unpause sweep проходит для всех
- [ ] На паузе payee делает sweep своего адреса: средства уходят по обычным правилам (payee + комиссия в treasury)
- [ ] На паузе sweep от чужого адреса (в том числе от другого payee) → `EnforcedPause`
- [ ] Токен с хуком, который из `transfer` повторно вызывает `sweep`, не может вывести больше баланса адреса (транзакция откатывается или сумма сходится)

### 3.3 RepaySubscriptions

#### 3.3.1 Модель
- Условия (`payee`, `token`, `amount`, `period`) задаёт подписчик в `subscribe`, и они **неизменяемы**. Бэкенд сверяет их с checkout-сессией.
- `feeBps` фиксируется при подписке.
- `Sub` упакован в 3 storage-слота.

| Параметр | Значение | Зачем |
|---|---|---|
| `MAX_FEE_BPS` | 300 | Потолок комиссии |
| `GRACE` | 3 days | Окно для списания после `nextChargeAt`, дальше `Expired` |
| `MIN_PERIOD` | 7 days | Должно быть `≥ GRACE`: ключевой инвариант против двойного списания |
| `maxAmount[token]` | например, 500e6 | Whitelist (0 = запрещён) + лимит на одно списание |

#### 3.3.2 Код (скелет)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

contract RepaySubscriptions is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant MAX_FEE_BPS = 300;
    uint32 public constant GRACE = 3 days;
    uint32 public constant MIN_PERIOD = 7 days; // MIN_PERIOD >= GRACE — инвариант

    struct Sub {
        address subscriber; uint40 nextChargeAt; uint32 chargeCount; uint16 feeBps; bool active;
        address payee; uint32 period; uint32 maxCharges;
        address token; uint96 amount;
    }

    mapping(uint256 => Sub) public subs;
    mapping(address => uint256) public maxAmount; // 0 = токен не разрешён
    uint256 public nextId;
    uint16 public feeBps;
    address public treasury;

    event SubscriptionCreated(uint256 indexed id, address indexed subscriber, address indexed payee,
        address token, uint96 amount, uint32 period, uint32 maxCharges, uint16 feeBps, bytes32 ref);
    event Charged(uint256 indexed id, uint32 indexed chargeIndex, uint256 amount, uint256 fee, uint40 nextChargeAt);
    event Cancelled(uint256 indexed id, address indexed by);

    error BadAmount(); error BadPeriod(); error BadAddress(); error NotActive();
    error NotDue(); error Expired(); error Completed(); error Unauthorized(); error FeeTooHigh();

    constructor(address initialOwner) Ownable(initialOwner) { treasury = initialOwner; }

    function subscribe(address token, address payee, uint96 amount, uint32 period, uint32 maxCharges, bytes32 ref)
        external whenNotPaused nonReentrant returns (uint256 id)
    {
        if (amount == 0 || amount > maxAmount[token]) revert BadAmount();
        if (period < MIN_PERIOD) revert BadPeriod();
        if (payee == address(0)) revert BadAddress();

        id = ++nextId;
        Sub storage s = subs[id];
        s.subscriber = msg.sender;                 // from ВСЕГДА = msg.sender при создании
        s.nextChargeAt = uint40(block.timestamp + period);
        s.chargeCount = 1;
        s.feeBps = feeBps;
        s.active = true;
        s.payee = payee; s.period = period; s.maxCharges = maxCharges;
        s.token = token; s.amount = amount;

        emit SubscriptionCreated(id, msg.sender, payee, token, amount, period, maxCharges, s.feeBps, ref);
        _pull(id, s, 1);                           // первое списание сразу
    }

    /// Permissionless, но только в окне [nextChargeAt, nextChargeAt + GRACE)
    function charge(uint256 id) external whenNotPaused nonReentrant {
        Sub storage s = subs[id];
        if (!s.active) revert NotActive();
        uint256 due = s.nextChargeAt;
        if (block.timestamp < due) revert NotDue();
        if (block.timestamp >= due + GRACE) revert Expired();
        if (s.maxCharges != 0 && s.chargeCount >= s.maxCharges) revert Completed();

        // Effects до Interactions; якорь сохраняется.
        // period >= GRACE > now - due  ⇒  новый nextChargeAt > now  ⇒  повторный charge невозможен.
        s.nextChargeAt = uint40(due + s.period);
        uint32 n = ++s.chargeCount;
        _pull(id, s, n);
    }

    function cancel(uint256 id) external {        // работает и на паузе
        Sub storage s = subs[id];
        if (msg.sender != s.subscriber && msg.sender != s.payee) revert Unauthorized();
        if (!s.active) revert NotActive();
        s.active = false;
        emit Cancelled(id, msg.sender);
    }

    function isDue(uint256 id) external view returns (bool) {
        Sub storage s = subs[id];
        return s.active && block.timestamp >= s.nextChargeAt && block.timestamp < s.nextChargeAt + GRACE
            && (s.maxCharges == 0 || s.chargeCount < s.maxCharges);
    }

    function setFee(uint16 bps) external onlyOwner { if (bps > MAX_FEE_BPS) revert FeeTooHigh(); feeBps = bps; }
    function setTreasury(address t) external onlyOwner { if (t == address(0)) revert BadAddress(); treasury = t; }
    function setMaxAmount(address token, uint256 cap) external onlyOwner { maxAmount[token] = cap; }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function _pull(uint256 id, Sub storage s, uint32 n) private {
        uint256 fee = uint256(s.amount) * s.feeBps / 10_000;
        IERC20 t = IERC20(s.token);
        t.safeTransferFrom(s.subscriber, s.payee, s.amount - fee); // from — только сохранённый subscriber
        if (fee != 0) t.safeTransferFrom(s.subscriber, treasury, fee);
        emit Charged(id, n, s.amount, fee, s.nextChargeAt);
    }
}
```

> Это скелет для старта, а не код, готовый к продакшену.

#### 3.3.3 Защиты от двойного списания и списания раньше срока
- [ ] `block.timestamp >= nextChargeAt`, иначе `NotDue`
- [ ] `nextChargeAt` сдвигается **до** переводов (CEI) + `nonReentrant`
- [ ] Инвариант `MIN_PERIOD ≥ GRACE` + строгая проверка `< due + GRACE` ⇒ после списания `nextChargeAt > now`
- [ ] Нет «догоняющих» списаний: максимум одно списание за окно
- [ ] Окно GRACE истекло → `Expired`: нет внезапного списания через месяцы
- [ ] `maxCharges`, `maxAmount[token]`, неизменяемые условия, зафиксированная `feeBps`
- [ ] Off-chain: UNIQUE `(subscription_id, charge_index)`, BullMQ jobId, `FOR UPDATE SKIP LOCKED`, simulate

#### 3.3.4 Защиты allowance (критично)
- [ ] Нет функций с произвольным `from` в `transferFrom`: только `msg.sender` или сохранённый `s.subscriber`
- [ ] У owner нет функций вывода, `delegatecall` и upgrade
- [ ] Checkout запрашивает ограниченный approve (`amount × N`), а не unlimited
- [ ] `Pausable` не блокирует `cancel`; пауза дольше GRACE переводит due-подписки в expired (зафиксировать в runbook)

#### 3.3.5 Тесты и инварианты
- [ ] Два `charge` в одном блоке → второй `NotDue`
- [ ] `charge` на 1 с раньше срока → `NotDue`; ровно в `due + GRACE` → `Expired`
- [ ] Fuzz по `period ∈ [MIN_PERIOD, 10 лет]` и сдвигу времени: после charge `nextChargeAt > now`
- [ ] Fuzz: сумма списаний == `chargeCount × amount`; `fee ≤ amount × 3%`
- [ ] Отменённая подписка не списывается; отменить могут только subscriber и payee
- [ ] `setFee` не влияет на существующие подписки
- [ ] Реентрантный токен → revert; USDT-подобный токен работает
- [ ] `maxCharges` соблюдается; пауза: `cancel` работает, `charge` нет

---

## 4. Чек-лист перед мейннетом

### 4.1 Смарт-контракты
- [ ] 100% покрытие, fuzz и инварианты зелёные (≥10k прогонов)
- [ ] Slither, Aderyn: 0 high / 0 medium
- [ ] Внешнее ревью обоих контрактов, находки закрыты или задокументированы
- [ ] В мейннет деплоится ровно тот коммит, который проверял аудитор (git-тег)
- [ ] Адрес `DepositFactory` **одинаковый** во всех 3 сетях
- [ ] Адреса токенов сверены с официальными источниками Circle/Tether
- [ ] Safe multisig 2/3 в каждой сети, ownership передан и принят
- [ ] Guarded launch: `maxAmount` для подписок ≈ $500; лимит на инвойс в API ≈ $1000
- [ ] Runbook инцидента: пауза, коммуникация с мерчантами

### 4.2 Payments-бэкенд
- [ ] Off-chain вычисление deposit-адреса == `addressOf` во всех сетях (тест в CI)
- [ ] Detector учитывает подтверждения, переживает рестарт, не дублирует события
- [ ] Покрыты сценарии: недоплата, переплата, два токена, оплата после истечения, «другая» поддерживаемая сеть
- [ ] Sweeper: повторы, пыль, алерт на неудачный sweep старше 15 минут
- [ ] Ежедневная сверка: сумма `invoice_deposits` == сумма `sweeps` + балансы ещё не обработанных адресов

### 4.3 Subscriptions-бэкенд
- [ ] Indexer: reorg-обработка, курсор, идемпотентность
- [ ] Keeper: сценарий «упал на 2 дня» → после рестарта списывает в окне GRACE без дублей
- [ ] Ежедневный SQL-отчёт: 0 дублей `charge_index`, 0 списаний раньше `next_charge_at`

### 4.4 Общее
- [ ] Кошельки sweeper/keeper отдельные на каждую сеть, с малым балансом, алерт на низкий газ, nonce manager
- [ ] Вебхуки: HMAC, защита от replay, ретраи, тест на недоступный endpoint
- [ ] API-ключи хранятся только как хэши, rate limit, CORS, helmet, валидация
- [ ] SIWE: nonce, domain, срок
- [ ] Смена payout-адреса мерчанта — самая ценная цель для атаки (все новые инвойсы уйдут атакующему): подтверждение подписью текущего кошелька (SIWE) + письмо мерчанту + задержка 24 ч перед применением, в течение которой смену можно отменить
- [ ] Checkout показывает только адрес, посчитанный из `addressOf`; перед показом сервер сверяет адрес в базе с пересчитанным (защита от подмены записи в БД)
- [ ] Санкционный скрининг адресов плательщика и payee (бесплатный Chainalysis sanctions API/oracle)
- [ ] Бэкапы Postgres + проверенное восстановление
- [ ] Резервный RPC (fallback transport в viem)

### 4.5 Фронтенд
- [ ] Оплата проверена с Binance, Bybit, OKX (вывод в Arbitrum/Polygon/Base) и из MetaMask, Rabby, Trust, Coinbase Wallet, в том числе на мобильных
- [ ] Чёткие предупреждения о сети и сумме, копирование адреса и суммы одним кликом
- [ ] Подписка: перед подписанием видны payee, сумма, период, лимит approve
- [ ] Портал отмены и отзыв approve работают
- [ ] CSP, отсутствие сторонних скриптов на checkout

### 4.6 Инфраструктура
- [ ] HTTPS, Cloudflare, firewall (наружу только 80/443)
- [ ] Алерты: лаг detector/indexer, неудачные sweep/charge, ошибки вебхуков, низкий газ
- [ ] Страница статуса

### 4.7 Юридическое и комплаенс (не юридическая консультация)
- [ ] ToS: non-custodial модель, платформа не хранит средства и не может их перенаправить; продукт и возвраты на ответственности мерчанта
- [ ] Privacy Policy (GDPR)
- [ ] Список запрещённых категорий мерчантов
- [ ] В некоторых юрисдикциях «платёжная система» — регулируемый термин; в публичных материалах позиционироваться как «программное обеспечение для приёма криптоплатежей». Проверить для РФ/EU (MiCA)/US
- [ ] В РФ оплата товаров и услуг криптовалютой запрещена законом; мерчантов из РФ принимать только с пониманием риска
- [ ] Telegram требует TON для крипто-функций внутри Mini Apps → в ботах давать внешнюю ссылку на checkout. Перепроверить актуальные правила

---

## 5. Привлечение первых 20 мерчантов

### 5.1 Позиционирование
**«Принимайте USDT/USDC на свой кошелёк — разовые платежи и подписки. Без custody, без блокировок, комиссия 1%.»**
Отличия от кастодиальных шлюзов: деньги не проходят через наш баланс, их нельзя заморозить, вывод не нужен; есть автосписания.

### 5.2 ICP (кого ищем)
| Сегмент | Что продаём | Где искать |
|---|---|---|
| Платные TG-каналы и боты (СНГ) | Payments + Subscriptions | tgstat, чаты разработчиков ботов |
| VPN / прокси / хостинг / игровые серверы | Payments (+ подписки) | Форумы, X, Telegram |
| Цифровые товары, ключи, инфопродукты | Payments, платёжные ссылки | Telegram, vc.ru, маркетплейсы |
| Indie SaaS / AI-обёртки | Subscriptions | Indie Hackers, r/SaaS, X |
| Фрилансеры и агентства | Платёжные ссылки | Telegram-чаты фрилансеров, X |

### 5.3 Оффер для первых 20
- [ ] **0% комиссии 3 месяца** (или на первые $10k оборота), дальше 1%
- [ ] **White-glove интеграция:** «подключу сам за вечер»
- [ ] Платёжные ссылки без кода: старт за 5 минут, без разработчика
- [ ] Open-source шаблон TG-бота (лид-магнит)
- [ ] Статус «Founding merchant»: логотип на сайте, прямой чат, влияние на роадмап

### 5.4 Воронка
`300 контактов → 60 ответов → 30 созвонов/демо → 25 тестовых интеграций → 20 live`
Платёжные ссылки сокращают путь до live: мерчант может начать без интеграции API.

### 5.5 План действий
**Неделя 3 (пре-лонч)**
- [ ] Таблица из 300 лидов: 120 TG-каналов/ботов, 60 VPN/хостинг/цифровые товары, 80 indie SaaS, 40 фрилансеров/агентств
- [ ] Шаблоны сообщений RU/EN по сегментам
- [ ] 100 персональных сообщений, 3–5 дружественных мерчантов на тестнете
- [ ] Демо-видео на 2 минуты: платёжная ссылка → оплата с биржи → деньги на кошельке мерчанта

**Неделя 4 (лонч)**
- [ ] Ещё 200 сообщений + фоллоуапы (D+3, D+7)
- [ ] Habr (технический разбор: deposit-адреса через CREATE2 + non-custodial подписки) + vc.ru (бизнес-кейс)
- [ ] Open-source репозиторий TG-бота + посты в чатах разработчиков ботов
- [ ] Тред в X, Product Hunt, r/SaaS
- [ ] Посевы в 3–5 TG-каналах о разработке и крипто-бизнесе

**Недели 5–8 (добор до 20)**
- [ ] Реферальная программа: $50 за мерчанта с оборотом ≥ $500
- [ ] Кейсы первых мерчантов с цифрами
- [ ] Гайды по интеграции (Next.js, grammY, aiogram) + плагин WooCommerce в бэклоге

### 5.6 Маркетинговый бюджет ($750)
| Статья | Сумма |
|---|---|
| Посевы в TG-каналах | $350 |
| Реферальные выплаты (до 5 × $50) | $250 |
| Продвижение статей и постов, подготовка к Product Hunt | $100 |
| Инструменты (Loom, рассылка) | $50 |

---

## 6. Бюджет $2000

| Категория | Статья | Сумма |
|---|---|---|
| **Инфраструктура (3 мес.)** | VPS Hetzner (app + db) | $90 |
| | RPC-провайдер (запас на платный тариф; detector активно читает сеть) | $150 |
| | Домен, почта | $30 |
| | Газ: деплой 2 контрактов в 3 сети, sweep/keeper на 3 месяца, Safe | $100 |
| | Мониторинг, Sentry, Cloudflare | $0 (free tier) |
| **Безопасность** | Ревью контрактов независимым аудитором (~300 SLOC) | $700 |
| | Аппаратный кошелёк для multisig (если нет) | $80 |
| **Юридическое** | Шаблоны ToS и Privacy | $50 |
| **Маркетинг** | См. 5.6 | $750 |
| **Резерв** | — | $50 |
| | **Итого** | **$2000** |

> $700 — это целевое ревью небольшого кода, а не полный аудит. Риск снижают минимальный код, отсутствие custody, адреса с зашитым payee, лимиты, пауза и прозрачная страница Security.
> Газ на sweep (деплой клона + переводы) на L2 обычно стоит центы. Его покрывает комиссия; минимальная сумма инвойса — $1.

---

## 7. Риски и бэклог v1.1

### Риски
- [ ] **Ошибки покупателей при переводе с биржи:** неверная сеть, сумма меньше из-за комиссии вывода. Митигация: крупные предупреждения, статус `underpaid` с доплатой, одинаковый адрес во всех поддерживаемых сетях.
- [ ] **Платёж в неподдерживаемую сеть** (Ethereum, BSC). Средства можно восстановить: деплой фабрики с теми же параметрами по тому же адресу в этой сети. Задокументировать процедуру и хранить ключ деплойера.
- [ ] **Газ и self-custody для подписок.** Подписчику нужен свой кошелёк и немного ETH/POL. Решение в v1.1: gasless.
- [ ] **TRON в СНГ.** Значительная часть USDT в СНГ лежит в TRON. Отслеживать отказы; TRON — первый кандидат в v2 (там нужна другая модель deposit-адресов).
- [ ] **Пауза дольше GRACE** переводит подписки в expired.
- [ ] **Регуляторика** РФ / EU (MiCA) / US.

### Бэклог v1.1 (по приоритету)
- [ ] Gasless-подписка для USDC: `subscribeWithPermit` (EIP-2612, permit в try/catch) + EIP-712 намерение, транзакцию отправляет keeper
- [ ] Плагины WooCommerce / Tilda / Shopify-подобные
- [ ] Batch-sweep и `chargeMany` для экономии газа
- [ ] Upgrade/downgrade планов, trial-периоды
- [ ] Уведомления подписчику перед списанием (email/TG)
- [ ] TRON
- [ ] Поддержка дополнительных EVM-сетей (Optimism, BSC)

---

## 8. Метрики успеха MVP

- [ ] Мейннет в 3 сетях, 0 инцидентов безопасности
- [ ] ≥ 5 мерчантов live к концу недели 4, ≥ 20 к концу недели 8
- [ ] Конверсия checkout инвойса (открыт → оплачен) ≥ 50%
- [ ] Доля `underpaid` < 5%
- [ ] Медианное время от оплаты до поступления средств мерчанту < 2 мин
- [ ] Доля успешных автосписаний среди due-подписок ≥ 85%
- [ ] 0 двойных списаний, 0 списаний раньше срока, ежедневная сверка платежей сходится в 0
- [ ] Доставка вебхуков ≥ 99%
