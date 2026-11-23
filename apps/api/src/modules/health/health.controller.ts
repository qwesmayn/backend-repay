import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Database } from '../../database/database.module.js';

const READINESS_TIMEOUT_MS = 2_000;

@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Процесс жив (для рестарта контейнера). Зависимости не проверяет. */
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Готов принимать трафик: Postgres отвечает. */
  @Get('ready')
  async ready(): Promise<{ status: 'ok'; checks: { postgres: 'up' } }> {
    try {
      await withTimeout(this.db.execute(sql`select 1`), READINESS_TIMEOUT_MS);
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        checks: { postgres: 'down' },
      });
    }
    return { status: 'ok', checks: { postgres: 'up' } };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
