import type { ConfigType } from '@nestjs/config';
import type databaseConfig from '../config/database.config.js';
import { type Database, DatabaseStartupCheck } from './database.module.js';

const config = {
  host: 'db.local',
  port: 5432,
  username: 'repay',
  password: 'secret',
  database: 'repay',
} satisfies ConfigType<typeof databaseConfig>;

function checkWith(execute: ReturnType<typeof vi.fn>): DatabaseStartupCheck {
  return new DatabaseStartupCheck({ execute } as unknown as Database, config);
}

describe('DatabaseStartupCheck', () => {
  it('passes when Postgres answers', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
    await expect(checkWith(execute).onApplicationBootstrap()).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledOnce();
  });

  it('fails fast with host, port and database in the message', async () => {
    const cause = new Error('ECONNREFUSED');
    const execute = vi.fn().mockRejectedValue(cause);
    const error = await checkWith(execute)
      .onApplicationBootstrap()
      .catch((e: unknown) => e as Error);

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe(
      'Postgres is unreachable at db.local:5432/repay: ECONNREFUSED',
    );
    expect(error?.cause).toBe(cause);
    expect(error?.message).not.toContain('secret');
  });
});
