import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import workerConfig from './config/worker.config.js';
import { WorkerModule } from './worker.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(await WorkerModule.forRoot());
  app.enableShutdownHooks();

  const { roles } = app.get<ConfigType<typeof workerConfig>>(workerConfig.KEY);
  new Logger('Bootstrap').log(`Worker started, roles: ${roles.join(', ')}`);
}
void bootstrap();
