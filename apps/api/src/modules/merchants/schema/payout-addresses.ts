import { integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt, evmAddressCheck, id } from '../../../database/columns.js';
import { merchants } from './merchants.js';

export const payoutAddresses = pgTable(
  'payout_addresses',
  {
    id: id(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    chainId: integer('chain_id'),
    address: text('address').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    // NULLS NOT DISTINCT: не больше одного «дефолтного» адреса (chain_id = null) на мерчанта.
    unique('payout_addresses_merchant_chain_uq').on(t.merchantId, t.chainId).nullsNotDistinct(),
    evmAddressCheck('payout_addresses_address_format', t.address),
  ],
);

export type PayoutAddress = typeof payoutAddresses.$inferSelect;
export type NewPayoutAddress = typeof payoutAddresses.$inferInsert;
