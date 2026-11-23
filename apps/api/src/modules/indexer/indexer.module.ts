import { Module } from '@nestjs/common';
import { ChainModule } from '../chain/chain.module.js';
import { InvoicesModule } from '../invoices/invoices.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';

/**
 * Роль воркера `indexer`: getLogs по контрактам (Swept, SubscriptionCreated, Charged, Cancelled)
 * с курсором в indexer_cursors, ожиданием подтверждений и откатом при reorg.
 * Запись в chain_events идемпотентна (UNIQUE chain_id + tx_hash + log_index).
 */
@Module({ imports: [ChainModule, InvoicesModule, SubscriptionsModule] })
export class IndexerModule {}
