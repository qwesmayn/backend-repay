import { type DynamicModule, Module, type Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configModuleOptions } from './config/config.options.js';
import type { WorkerRole } from './config/env.validation.js';
import workerConfig from './config/worker.config.js';
import { DatabaseModule } from './database/database.module.js';
import { DetectorModule } from './modules/detector/detector.module.js';
import { IndexerModule } from './modules/indexer/indexer.module.js';
import { KeeperModule } from './modules/keeper/keeper.module.js';
import { SweeperModule } from './modules/sweeper/sweeper.module.js';
import { WebhooksWorkerModule } from './modules/webhooks/webhooks-worker.module.js';
import { QueueModule } from './queue/queue.module.js';

export const ROLE_MODULES: Record<WorkerRole, Type> = {
  detector: DetectorModule,
  sweeper: SweeperModule,
  indexer: IndexerModule,
  keeper: KeeperModule,
  webhooks: WebhooksWorkerModule,
};

export function roleModules(roles: readonly WorkerRole[]): Type[] {
  return roles.map((role) => ROLE_MODULES[role]);
}

/**
 * Без HTTP: воркер обрабатывает очереди и таймеры. Набор ролей задаёт WORKER_ROLES:
 * в разработке — все в одном процессе, в проде — можно разнести по контейнерам.
 */
@Module({})
export class WorkerModule {
  static async forRoot(): Promise<DynamicModule> {
    // forRoot загружает .env и валидирует окружение — только после этого роли можно читать.
    const configModule = await ConfigModule.forRoot(configModuleOptions);
    const { roles } = workerConfig();

    return {
      module: WorkerModule,
      imports: [configModule, DatabaseModule, QueueModule, ...roleModules(roles)],
    };
  }
}
