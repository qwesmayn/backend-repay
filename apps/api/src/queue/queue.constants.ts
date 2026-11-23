export const QUEUE = {
  /** Доставка вебхуков мерчантам (наполняется из outbox-таблицы). */
  webhookDelivery: 'webhook-delivery',
} as const;

/**
 * Очередь отправки on-chain транзакций для одной сети.
 * Обрабатывается строго с concurrency = 1 и одним кошельком, иначе sweep и charge
 * конфликтуют по nonce.
 */
export function txQueueName(chainId: number): string {
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(`Invalid chainId: ${chainId}`);
  }
  return `tx-${chainId}`;
}
