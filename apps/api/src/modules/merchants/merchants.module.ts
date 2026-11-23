import { Module } from '@nestjs/common';

/**
 * Merchants — мерчанты, SIWE-логин, API-ключи (только sha256-хэш), payout-адреса.
 * Таблицы: merchants, payout_addresses, api_keys.
 */
@Module({})
export class MerchantsModule {}
