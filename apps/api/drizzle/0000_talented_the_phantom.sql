CREATE TYPE "public"."api_key_mode" AS ENUM('test', 'live');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"prefix" text NOT NULL,
	"sha256_hash" text NOT NULL,
	"mode" "api_key_mode" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_keys_sha256_hash_unique" UNIQUE("sha256_hash")
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"fee_bps" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_wallet_address_unique" UNIQUE("wallet_address"),
	CONSTRAINT "merchants_wallet_address_format" CHECK ("merchants"."wallet_address" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "merchants_fee_bps_range" CHECK ("merchants"."fee_bps" between 0 and 10000)
);
--> statement-breakpoint
CREATE TABLE "payout_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"chain_id" integer,
	"address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_addresses_merchant_chain_uq" UNIQUE NULLS NOT DISTINCT("merchant_id","chain_id"),
	CONSTRAINT "payout_addresses_address_format" CHECK ("payout_addresses"."address" ~ '^0x[0-9a-f]{40}$')
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_addresses" ADD CONSTRAINT "payout_addresses_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_merchant_id_idx" ON "api_keys" USING btree ("merchant_id");