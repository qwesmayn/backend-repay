import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import appConfig from './config/app.config.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');

  const { port, nodeEnv } = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  await app.listen(port);

  new Logger('Bootstrap').log(`API listening on :${port} (${nodeEnv})`);
}
void bootstrap();
