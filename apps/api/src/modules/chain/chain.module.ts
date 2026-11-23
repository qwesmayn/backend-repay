import { Module } from '@nestjs/common';

/**
 * Chain — работа с блокчейном: конфиг сетей (Arbitrum, Base, Polygon), viem-клиенты
 * с fallback-RPC, адреса контрактов и токенов, отправка транзакций.
 *
 * Отправка транзакций — только через очередь `tx-<chainId>` (concurrency = 1, один кошелёк
 * на сеть): simulate → send → ожидание receipt. Так исключаются конфликты nonce.
 */
@Module({})
export class ChainModule {}
