import { Module } from '@nestjs/common';

/**
 * Webhooks (сторона API) — настройка endpoint'ов мерчанта и запись событий в outbox.
 *
 * Правило outbox: смена статуса (инвойса/подписки) и вставка в webhook_events
 * выполняются в ОДНОЙ транзакции Postgres. В очередь отсюда ничего не пишется.
 * Таблицы: webhook_endpoints, webhook_events, webhook_deliveries.
 */
@Module({})
export class WebhooksModule {}
