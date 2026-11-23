import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE } from '../../queue/queue.constants.js';
import { WebhooksModule } from './webhooks.module.js';

/**
 * Роль воркера `webhooks`:
 * 1) relay: читает недоставленные события из outbox (webhook_events) и ставит задачи
 *    в очередь с jobId = event.id (дедупликация);
 * 2) delivery: POST на endpoint мерчанта с подписью `Repay-Signature: t=<ts>,v1=<hmac>`,
 *    экспоненциальные ретраи, лог в webhook_deliveries.
 */
@Module({
  imports: [WebhooksModule, BullModule.registerQueue({ name: QUEUE.webhookDelivery })],
})
export class WebhooksWorkerModule {}
