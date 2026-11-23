import type { ConfigModuleOptions } from '@nestjs/config';
import appConfig from './app.config.js';
import databaseConfig from './database.config.js';
import { envSchema } from './env.validation.js';
import redisConfig from './redis.config.js';
import workerConfig from './worker.config.js';

export const configModuleOptions: ConfigModuleOptions = {
  isGlobal: true,
  envFilePath: '.env',
  ignoreEnvFile: process.env.NODE_ENV === 'test',
  validationSchema: envSchema,
  load: [appConfig, databaseConfig, redisConfig, workerConfig],
};
