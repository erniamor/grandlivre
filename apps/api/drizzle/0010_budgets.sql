CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"period" text NOT NULL,
	"amount" bigint,
	"from_month" date NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_tagId_fromMonth_unique" UNIQUE("tag_id","from_month"),
	CONSTRAINT "budgets_amount_positive" CHECK ("budgets"."amount" is null or "budgets"."amount" > 0),
	CONSTRAINT "budgets_from_first_day" CHECK (extract(day from "budgets"."from_month") = 1)
);
--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_tag_id_household_id_tags_id_household_id_fk" FOREIGN KEY ("tag_id","household_id") REFERENCES "public"."tags"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budgets_household_id_index" ON "budgets" USING btree ("household_id");