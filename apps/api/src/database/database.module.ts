import {
  Global,
  Inject,
  Injectable,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import databaseConfig from '../config/database.config.js';
import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;

export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

const CONNECT_TIMEOUT_MS = 5_000;

@Injectable()
class PoolShutdown implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}


@Injectable()
export class DatabaseStartupCheck implements OnApplicationBootstrap {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(databaseConfig.KEY)
    private readonly config: ConfigType<typeof databaseConfig>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.db.execute(sql`select 1`);
    } catch (error) {
      const { host, port, database } = this.config;
      throw new Error(
        `Postgres is unreachable at ${host}:${port}/${database}: ${(error as Error).message}`,
        { cause: error },
      );
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [databaseConfig.KEY],
      useFactory: (db: ConfigType<typeof databaseConfig>) =>
        new pg.Pool({
          host: db.host,
          port: db.port,
          user: db.username,
          password: db.password,
          database: db.database,
          max: 10,
          connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
        }),
    },
    {
      provide: DB,
      inject: [PG_POOL],
      useFactory: (pool: pg.Pool): Database => drizzle({ client: pool, schema }),
    },
    PoolShutdown,
    DatabaseStartupCheck,
  ],
  exports: [DB],
})
export class DatabaseModule {}
