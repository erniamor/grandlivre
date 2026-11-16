CREATE TABLE "statement_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"number_hash" text NOT NULL,
	"bank_name" text NOT NULL,
	"number_end" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statement_accounts_householdId_numberHash_unique" UNIQUE("household_id","number_hash")
);
--> statement-breakpoint
CREATE TABLE "statement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"transaction_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statement_lines_accountId_externalId_unique" UNIQUE("account_id","external_id")
);
--> statement-breakpoint
DROP INDEX "transactions_account_id_external_id_index";--> statement-breakpoint
ALTER TABLE "statement_accounts" ADD CONSTRAINT "statement_accounts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_accounts" ADD CONSTRAINT "statement_accounts_account_id_household_id_ledger_accounts_id_household_id_fk" FOREIGN KEY ("account_id","household_id") REFERENCES "public"."ledger_accounts"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_account_id_household_id_ledger_accounts_id_household_id_fk" FOREIGN KEY ("account_id","household_id") REFERENCES "public"."ledger_accounts"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_transaction_id_household_id_transactions_id_household_id_fk" FOREIGN KEY ("transaction_id","household_id") REFERENCES "public"."transactions"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "statement_accounts_account_id_index" ON "statement_accounts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "statement_lines_transaction_id_index" ON "statement_lines" USING btree ("transaction_id");--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "external_id";