import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configModuleOptions } from './config/config.options.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InvoicesModule } from './modules/invoices/invoices.module.js';
import { MerchantsModule } from './modules/merchants/merchants.module.js';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module.js';
import { WebhooksModule } from './modules/webhooks/webhooks.module.js';

@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions),
    DatabaseModule,
    HealthModule,
    MerchantsModule,
    InvoicesModule,
    SubscriptionsModule,
    WebhooksModule,
  ],
})
export class AppModule {}
