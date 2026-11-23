import { Module } from '@nestjs/common';
import { MerchantsModule } from '../merchants/merchants.module.js';
import { WebhooksModule } from '../webhooks/webhooks.module.js';

/**
 * Subscriptions — продукты, цены, checkout-сессии, подписки и списания.
 * Статусы подписки выводятся только из on-chain событий (SubscriptionCreated, Charged, Cancelled).
 * Таблицы: products, prices, checkout_sessions, subscriptions, charges, charge_attempts.
 */
@Module({ imports: [MerchantsModule, WebhooksModule] })
export class SubscriptionsModule {}
