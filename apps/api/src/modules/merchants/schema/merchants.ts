import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { createdAt, evmAddressCheck, id } from '../../../database/columns.js';

export const merchants = pgTable(
  'merchants',
  {
    id: id(),
    walletAddress: text('wallet_address').notNull().unique(),
    name: text('name').notNull(),
    email: text('email'),
    // Комиссия в базисных пунктах: 100 = 1%.
    feeBps: integer('fee_bps').notNull().default(100),
    createdAt: createdAt(),
  },
  (t) => [
    evmAddressCheck('merchants_wallet_address_format', t.walletAddress),
    check('merchants_fee_bps_range', sql`${t.feeBps} between 0 and 10000`),
  ],
);

export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;
