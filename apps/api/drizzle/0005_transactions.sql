CREATE TABLE "transaction_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"amount" bigint NOT NULL,
	"tag_id" uuid,
	CONSTRAINT "transaction_lines_amount_positive" CHECK ("transaction_lines"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"type" text NOT NULL,
	"date" date NOT NULL,
	"account_id" uuid NOT NULL,
	"to_account_id" uuid,
	"amount" bigint NOT NULL,
	"payee" text,
	"note" text,
	"origin" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_id_householdId_unique" UNIQUE("id","household_id"),
	CONSTRAINT "transactions_amount_positive" CHECK ("transactions"."amount" > 0),
	CONSTRAINT "transactions_transfer_destination" CHECK (("transactions"."type" = 'transfer') = ("transactions"."to_account_id" is not null) and "transactions"."to_account_id" is distinct from "transactions"."account_id")
);
--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_transaction_id_household_id_transactions_id_household_id_fk" FOREIGN KEY ("transaction_id","household_id") REFERENCES "public"."transactions"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_tag_id_household_id_tags_id_household_id_fk" FOREIGN KEY ("tag_id","household_id") REFERENCES "public"."tags"("id","household_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_household_id_ledger_accounts_id_household_id_fk" FOREIGN KEY ("account_id","household_id") REFERENCES "public"."ledger_accounts"("id","household_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_account_id_household_id_ledger_accounts_id_household_id_fk" FOREIGN KEY ("to_account_id","household_id") REFERENCES "public"."ledger_accounts"("id","household_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transaction_lines_transaction_id_index" ON "transaction_lines" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "transaction_lines_tag_id_index" ON "transaction_lines" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "transactions_household_id_date_id_index" ON "transactions" USING btree ("household_id","date" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "transactions_account_id_index" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transactions_to_account_id_index" ON "transactions" USING btree ("to_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_account_id_external_id_index" ON "transactions" USING btree ("account_id","external_id") WHERE "transactions"."external_id" is not null;