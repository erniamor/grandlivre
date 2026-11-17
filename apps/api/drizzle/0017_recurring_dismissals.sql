CREATE TABLE "recurring_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"to_account_id" uuid,
	"type" text NOT NULL,
	"key" text NOT NULL,
	"unit" text NOT NULL,
	"interval" integer NOT NULL,
	"start_date" date NOT NULL,
	"dismissed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_dismissals" ADD CONSTRAINT "recurring_dismissals_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_dismissals" ADD CONSTRAINT "recurring_dismissals_dismissed_by_users_id_fk" FOREIGN KEY ("dismissed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_dismissals" ADD CONSTRAINT "recurring_dismissals_account_id_household_id_ledger_accounts_id_household_id_fk" FOREIGN KEY ("account_id","household_id") REFERENCES "public"."ledger_accounts"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_dismissals" ADD CONSTRAINT "recurring_dismissals_to_account_id_household_id_ledger_accounts_id_household_id_fk" FOREIGN KEY ("to_account_id","household_id") REFERENCES "public"."ledger_accounts"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_dismissals_household_id_index" ON "recurring_dismissals" USING btree ("household_id");