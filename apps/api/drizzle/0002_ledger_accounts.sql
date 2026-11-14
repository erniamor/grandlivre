CREATE TABLE "ledger_account_holders" (
	"account_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_account_holders_account_id_user_id_pk" PRIMARY KEY("account_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"visibility" text NOT NULL,
	"opening_balance" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_accounts_id_householdId_unique" UNIQUE("id","household_id")
);
--> statement-breakpoint
ALTER TABLE "ledger_account_holders" ADD CONSTRAINT "ledger_account_holders_account_id_household_id_ledger_accounts_id_household_id_fk" FOREIGN KEY ("account_id","household_id") REFERENCES "public"."ledger_accounts"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_account_holders" ADD CONSTRAINT "ledger_account_holders_household_id_user_id_household_members_household_id_user_id_fk" FOREIGN KEY ("household_id","user_id") REFERENCES "public"."household_members"("household_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_account_holders_household_id_user_id_index" ON "ledger_account_holders" USING btree ("household_id","user_id");--> statement-breakpoint
CREATE INDEX "ledger_accounts_household_id_index" ON "ledger_accounts" USING btree ("household_id");