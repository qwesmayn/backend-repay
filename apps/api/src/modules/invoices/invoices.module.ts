import { Module } from '@nestjs/common';
import { MerchantsModule } from '../merchants/merchants.module.js';
import { WebhooksModule } from '../webhooks/webhooks.module.js';

/**
 * Invoices (Payments) — инвойсы, платёжные ссылки, вычисление deposit-адресов (CREATE2),
 * статусы pending → confirming → paid | underpaid | overpaid → settled | expired | paid_late.
 * Таблицы: invoices, invoice_deposits, sweeps, payment_links, refunds.
 */
@Module({ imports: [MerchantsModule, WebhooksModule] })
export class InvoicesModule {}
