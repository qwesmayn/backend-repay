import { Module } from '@nestjs/common';
import { ChainModule } from '../chain/chain.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';

/**
 * Роль воркера `keeper`: раз в минуту выбирает подписки с next_charge_at <= now()
 * (FOR UPDATE SKIP LOCKED), проверяет баланс/allowance и ставит charge() в очередь
 * `tx-<chainId>` с jobId `<chainId>:<subId>:<chargeIndex>`.
 */
@Module({ imports: [ChainModule, SubscriptionsModule] })
export class KeeperModule {}
