CREATE TABLE "statement_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"format" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statement_imports_id_householdId_unique" UNIQUE("id","household_id")
);
--> statement-breakpoint
ALTER TABLE "statement_lines" ADD COLUMN "import_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "statement_lines" ADD COLUMN "kind" text NOT NULL;--> statement-breakpoint
ALTER TABLE "statement_imports" ADD CONSTRAINT "statement_imports_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_imports" ADD CONSTRAINT "statement_imports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "statement_imports_household_id_created_at_index" ON "statement_imports" USING btree ("household_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_import_id_household_id_statement_imports_id_household_id_fk" FOREIGN KEY ("import_id","household_id") REFERENCES "public"."statement_imports"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "statement_lines_import_id_index" ON "statement_lines" USING btree ("import_id");--> statement-breakpoint
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_accountId_transactionId_unique" UNIQUE("account_id","transaction_id");