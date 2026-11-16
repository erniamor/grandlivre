CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"date" date NOT NULL,
	"note" text,
	"transaction_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlements_amount_positive" CHECK ("settlements"."amount" > 0),
	CONSTRAINT "settlements_two_members" CHECK ("settlements"."from_user_id" <> "settlements"."to_user_id")
);
--> statement-breakpoint
CREATE TABLE "sharing_weights" (
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"weight" integer NOT NULL,
	CONSTRAINT "sharing_weights_household_id_user_id_pk" PRIMARY KEY("household_id","user_id"),
	CONSTRAINT "sharing_weights_weight" CHECK ("sharing_weights"."weight" >= 0)
);
--> statement-breakpoint
CREATE TABLE "transaction_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "transaction_shares_transactionId_userId_unique" UNIQUE("transaction_id","user_id"),
	CONSTRAINT "transaction_shares_amount" CHECK ("transaction_shares"."amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "expense_sharing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "share_split" jsonb;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "share_paid_by" uuid;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sharing_weights" ADD CONSTRAINT "sharing_weights_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sharing_weights" ADD CONSTRAINT "sharing_weights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_shares" ADD CONSTRAINT "transaction_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_shares" ADD CONSTRAINT "transaction_shares_transaction_id_household_id_transactions_id_household_id_fk" FOREIGN KEY ("transaction_id","household_id") REFERENCES "public"."transactions"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "settlements_household_id_date_index" ON "settlements" USING btree ("household_id","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transaction_shares_household_id_index" ON "transaction_shares" USING btree ("household_id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_share_paid_by_users_id_fk" FOREIGN KEY ("share_paid_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;