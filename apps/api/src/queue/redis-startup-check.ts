import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Redis } from 'ioredis';
import redisConfig from '../config/redis.config.js';

const STARTUP_TIMEOUT_MS = 5_000;

/**
 * Fail fast: воркер без Redis бесполезен, а BullMQ по умолчанию бесконечно
 * переподключается молча. Проверяем один раз при старте и падаем с понятной ошибкой.
 */
@Injectable()
export class RedisStartupCheck implements OnApplicationBootstrap {
  private readonly logger = new Logger(RedisStartupCheck.name);

  constructor(
    @Inject(redisConfig.KEY)
    private readonly redis: ConfigType<typeof redisConfig>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const client = new Redis({
      host: this.redis.host,
      port: this.redis.port,
      password: this.redis.password,
      lazyConnect: true,
      connectTimeout: STARTUP_TIMEOUT_MS,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    client.on('error', () => undefined); // ошибку обрабатываем ниже, без шума в логах

    try {
      await client.connect();
      const policy = (await client.config('GET', 'maxmemory-policy')) as string[];
      if (policy[1] !== 'noeviction') {
        this.logger.warn(
          `Redis maxmemory-policy="${policy[1]}". BullMQ требует "noeviction", иначе задачи могут пропадать.`,
        );
      }
    } catch (error) {
      throw new Error(
        `Redis is unreachable at ${this.redis.host}:${this.redis.port}: ${(error as Error).message}`,
        { cause: error },
      );
    } finally {
      client.disconnect();
    }
  }
}
