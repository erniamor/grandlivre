CREATE TABLE "recurring_transaction_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"amount" bigint NOT NULL,
	"tag_id" uuid,
	CONSTRAINT "recurring_transaction_lines_amount_positive" CHECK ("recurring_transaction_lines"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "recurring_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"type" text NOT NULL,
	"account_id" uuid NOT NULL,
	"to_account_id" uuid,
	"amount" bigint NOT NULL,
	"payee" text,
	"note" text,
	"unit" text NOT NULL,
	"interval" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"mode" text DEFAULT 'confirm' NOT NULL,
	"next_date" date,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_transactions_id_householdId_unique" UNIQUE("id","household_id"),
	CONSTRAINT "recurring_transactions_amount_positive" CHECK ("recurring_transactions"."amount" > 0),
	CONSTRAINT "recurring_transactions_interval_positive" CHECK ("recurring_transactions"."interval" > 0),
	CONSTRAINT "recurring_transactions_transfer_destination" CHECK (("recurring_transactions"."type" = 'transfer') = ("recurring_transactions"."to_account_id" is not null) and "recurring_transactions"."to_account_id" is distinct from "recurring_transactions"."account_id")
);
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "time_zone" text DEFAULT 'America/Toronto' NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_transaction_lines" ADD CONSTRAINT "recurring_transaction_lines_recurring_id_household_id_recurring_transactions_id_household_id_fk" FOREIGN KEY ("recurring_id","household_id") REFERENCES "public"."recurring_transactions"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_lines" ADD CONSTRAINT "recurring_transaction_lines_tag_id_household_id_tags_id_household_id_fk" FOREIGN KEY ("tag_id","household_id") REFERENCES "public"."tags"("id","household_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_account_id_household_id_ledger_accounts_id_household_id_fk" FOREIGN KEY ("account_id","household_id") REFERENCES "public"."ledger_accounts"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_to_account_id_household_id_ledger_accounts_id_household_id_fk" FOREIGN KEY ("to_account_id","household_id") REFERENCES "public"."ledger_accounts"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_transaction_lines_recurring_id_index" ON "recurring_transaction_lines" USING btree ("recurring_id");--> statement-breakpoint
CREATE INDEX "recurring_transaction_lines_tag_id_index" ON "recurring_transaction_lines" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "recurring_transactions_household_id_index" ON "recurring_transactions" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "recurring_transactions_next_date_index" ON "recurring_transactions" USING btree ("next_date");