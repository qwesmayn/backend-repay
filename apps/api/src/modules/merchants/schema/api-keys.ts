import { index, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, timestamptz } from '../../../database/columns.js';
import { merchants } from './merchants.js';

export const apiKeyMode = pgEnum('api_key_mode', ['test', 'live']);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: id(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    prefix: text('prefix').notNull(),
    sha256Hash: text('sha256_hash').notNull().unique(),
    mode: apiKeyMode('mode').notNull(),
    createdAt: createdAt(),
    lastUsedAt: timestamptz('last_used_at'),
    revokedAt: timestamptz('revoked_at'),
  },
  (t) => [index('api_keys_merchant_id_idx').on(t.merchantId)],
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
