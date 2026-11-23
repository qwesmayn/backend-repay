import { txQueueName } from './queue.constants.js';

describe('txQueueName', () => {
  it('builds per-chain queue name without colons', () => {
    expect(txQueueName(42161)).toBe('tx-42161');
    expect(txQueueName(8453)).not.toContain(':');
  });

  it('rejects invalid chainId', () => {
    expect(() => txQueueName(0)).toThrow();
    expect(() => txQueueName(1.5)).toThrow();
  });
});
