CREATE TABLE "tag_names" (
	"tag_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tag_names_tag_id_locale_pk" PRIMARY KEY("tag_id","locale")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_id_householdId_unique" UNIQUE("id","household_id")
);
--> statement-breakpoint
ALTER TABLE "tag_names" ADD CONSTRAINT "tag_names_tag_id_household_id_tags_id_household_id_fk" FOREIGN KEY ("tag_id","household_id") REFERENCES "public"."tags"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_parent_id_household_id_tags_id_household_id_fk" FOREIGN KEY ("parent_id","household_id") REFERENCES "public"."tags"("id","household_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tag_names_household_id_locale_name_unique" ON "tag_names" USING btree ("household_id","locale",lower("name"));--> statement-breakpoint
CREATE INDEX "tags_household_id_index" ON "tags" USING btree ("household_id");