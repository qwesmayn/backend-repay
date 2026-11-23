import { Module } from '@nestjs/common';
import { ChainModule } from '../chain/chain.module.js';
import { InvoicesModule } from '../invoices/invoices.module.js';

/**
 * Роль воркера `sweeper`: для оплаченных инвойсов ставит sweep() в очередь `tx-<chainId>`
 * с jobId `<chainId>:<invoiceId>:<token>`. Порог «пыли», алерт на зависший sweep.
 */
@Module({ imports: [ChainModule, InvoicesModule] })
export class SweeperModule {}
