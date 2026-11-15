CREATE TABLE "recurring_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" text NOT NULL,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_occurrences_recurringId_date_unique" UNIQUE("recurring_id","date")
);
--> statement-breakpoint
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_recurring_id_household_id_recurring_transactions_id_household_id_fk" FOREIGN KEY ("recurring_id","household_id") REFERENCES "public"."recurring_transactions"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_occurrences_household_id_status_index" ON "recurring_occurrences" USING btree ("household_id","status");