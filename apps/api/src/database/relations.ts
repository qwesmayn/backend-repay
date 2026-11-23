import { relations } from 'drizzle-orm';
import { apiKeys, merchants, payoutAddresses } from '../modules/merchants/schema/index.js';

export const merchantsRelations = relations(merchants, ({ many }) => ({
  payoutAddresses: many(payoutAddresses),
  apiKeys: many(apiKeys),
}));

export const payoutAddressesRelations = relations(payoutAddresses, ({ one }) => ({
  merchant: one(merchants, { fields: [payoutAddresses.merchantId], references: [merchants.id] }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  merchant: one(merchants, { fields: [apiKeys.merchantId], references: [merchants.id] }),
}));
