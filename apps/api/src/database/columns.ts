import { sql } from 'drizzle-orm';
import { type AnyPgColumn, check, timestamp, uuid } from 'drizzle-orm/pg-core';

/** uuid PK c gen_random_uuid() на стороне БД. */
export const id = () => uuid('id').primaryKey().defaultRandom();

/** timestamptz: не зависим от TZ сервера. */
export const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const createdAt = () => timestamptz('created_at').notNull().defaultNow();

/** CHECK на EVM-адрес в lowercase (0x + 40 hex). Перед записью адрес нужно привести к lowercase. */
export const evmAddressCheck = (name: string, column: AnyPgColumn) =>
  check(name, sql`${column} ~ '^0x[0-9a-f]{40}$'`);
