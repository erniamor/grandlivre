ALTER TABLE "statement_imports" ADD COLUMN "opening_balances" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "statement_lines" ADD COLUMN "joined_before" jsonb;