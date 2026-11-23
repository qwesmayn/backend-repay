import { Module } from '@nestjs/common';
import { ChainModule } from '../chain/chain.module.js';
import { InvoicesModule } from '../invoices/invoices.module.js';

/**
 * Роль воркера `detector`: раз в 5–10 с читает balanceOf deposit-адресов активных инвойсов
 * (multicall, блок latest − N подтверждений) и обновляет статусы инвойсов.
 * Источник работы — таблица invoices, а не очередь.
 */
@Module({ imports: [ChainModule, InvoicesModule] })
export class DetectorModule {}
