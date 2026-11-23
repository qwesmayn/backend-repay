import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import redisConfig from '../config/redis.config.js';
import { RedisStartupCheck } from './redis-startup-check.js';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [redisConfig.KEY],
      useFactory: (redis: ConfigType<typeof redisConfig>) => ({
        connection: {
          host: redis.host,
          port: redis.port,
          password: redis.password,
        },
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { age: 7 * 24 * 3600, count: 10_000 },
          removeOnFail: { age: 30 * 24 * 3600 },
        },
      }),
    }),
  ],
  providers: [RedisStartupCheck],
  exports: [BullModule],
})
export class QueueModule {}
